/**
 * /api/scan — scan data directory for sessions
 *
 * Calls the local analysis service (FastAPI + behav_utils) to process
 * raw trial CSVs. Falls back to reading pre-computed session_stats JSON
 * files if the analysis service isn't running.
 *
 * Copy to: src/routes/api/scan/+server.js
 */

import { json } from '@sveltejs/kit';
import { readProject } from '$lib/server/db.js';
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, basename } from 'path';
import { Agent, fetch } from 'undici';

// Analysis service URL — same machine
const ANALYSIS_URL = process.env.ANALYSIS_URL || 'http://localhost:8100';

export async function POST({ request }) {
  const body = await request.json();
  const { dataDir, projectId, configYaml } = body;

  if (!dataDir || !existsSync(dataDir)) {
    return json({ ok: false, error: `Directory not found: ${dataDir}` }, { status: 400 });
  }

  // Try the analysis service first
  const config = configYaml || await _getConfigYaml(projectId);
  if (config) {
    try {
      const result = await _scanViaService(dataDir, config, body.animalIds);
      if (result) return json(result);
    } catch (e) {
      console.warn(`[scan] Analysis service error:`, e);
      console.warn(`[scan] Cause:`, e.cause);
    }
  }

  // Fallback: read pre-computed session_stats JSON files
  return json(await _scanJsonFiles(dataDir));
}


/**
 * Call the analysis service to process raw CSVs.
 */
async function _scanViaService(dataDir, configYaml, animalIds) {
  // Custom agent: disable undici's internal timeouts so long scans don't drop.
  // 20 min on each phase. AbortController also applies as a hard outer limit.
  const agent = new Agent({
    headersTimeout: 1_200_000,   // 20 min
    bodyTimeout:    1_200_000,
    keepAliveTimeout: 1_200_000,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_200_000);

  try {
    const res = await fetch(`${ANALYSIS_URL}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data_dir: dataDir,
        config_yaml: configYaml,
        animal_ids: animalIds || null,
      }),
      signal: controller.signal,
      dispatcher: agent,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Analysis service returned ${res.status}: ${err}`);
    }

    const data = await res.json();

    return {
      ok: true,
      sessions: (data.sessions || []).map(s => ({
        animal_id: s.animal_id,
        date: s.date,
        stage: s.stage,
        distribution: s.distribution,
        folder: s.folder,
        pdfs: [],
        metrics: {
          ...s.metrics,
          n_trials_total: s.n_trials_total,
          n_trials_valid: s.n_trials_valid,
          animal_id: s.animal_id,
          date: s.date,
          stage: s.stage,
        },
      })),
      errors: data.errors || [],
      source: 'analysis-service',
    };
  } finally {
    clearTimeout(timeout);
    await agent.close();
  }
}


/**
 * Get config YAML from the project's database record.
 */
async function _getConfigYaml(projectId) {
  if (!projectId) return null;
  try {
    const project = await readProject(projectId);
    return project?.settings?.config_yaml || null;
  } catch {
    return null;
  }
}


/**
 * Fallback: scan for pre-computed session_stats_*.json files.
 * This is the original scan behaviour — reads JSON files produced
 * by the old Python pipeline.
 */
async function _scanJsonFiles(dataDir) {
  const sessions = [];
  const errors = [];

  try {
    const animalDirs = readdirSync(dataDir).filter(d => {
      const full = join(dataDir, d);
      return statSync(full).isDirectory();
    });

    for (const animalId of animalDirs) {
      const animalPath = join(dataDir, animalId);
      let sessionDirs;
      try {
        sessionDirs = readdirSync(animalPath).filter(d => {
          const full = join(animalPath, d);
          return statSync(full).isDirectory();
        });
      } catch { continue; }

      for (const sessionDir of sessionDirs) {
        const sessionPath = join(animalPath, sessionDir);

        let statsFile = null;
        try {
          const files = readdirSync(sessionPath);
          statsFile = files.find(f => f.startsWith('session_stats_') && f.endsWith('.json'));
        } catch { continue; }

        if (!statsFile) continue;

        try {
          const raw = readFileSync(join(sessionPath, statsFile), 'utf-8');
          const stats = JSON.parse(raw);

          // Distribution from CSV if not in JSON
          let distribution = stats.distribution || null;
          if (!distribution) {
            const files = readdirSync(sessionPath);
            const csvFile = files.find(f => f.startsWith('trial_summary_') && f.endsWith('.csv'));
            if (csvFile) {
              try {
                const csvRaw = readFileSync(join(sessionPath, csvFile), 'utf-8');
                const lines = csvRaw.split('\n');
                if (lines.length >= 2) {
                  const headers = lines[0].split(',');
                  const values = lines[1].split(',');
                  const distIdx = headers.indexOf('Distribution');
                  if (distIdx >= 0) distribution = values[distIdx]?.trim() || null;
                }
              } catch { /* ignore */ }
            }
          }

          // List available PDFs
          const allFiles = readdirSync(sessionPath);
          const pdfs = allFiles.filter(f => f.endsWith('.pdf')).map(f => ({
            name: f,
            type: f.startsWith('performance_plot') ? 'performance'
              : f.startsWith('psychometric_curve') ? 'psychometric'
              : f.startsWith('shift_profile') ? 'shift_profile'
              : 'other',
          }));

          sessions.push({
            animal_id: stats.animal_id || animalId,
            date: stats.date ? stats.date.split(' ')[0] : null,
            stage: stats.stage || null,
            distribution,
            folder: `${animalId}/${sessionDir}`,
            pdfs,
            metrics: stats,
          });
        } catch (e) {
          errors.push(`${animalId}/${sessionDir}: ${e.message}`);
        }
      }
    }
  } catch (e) {
    return { ok: false, error: `Scan failed: ${e.message}` };
  }

  return {
    ok: true,
    sessions: sessions.sort((a, b) => {
      const cmp = (a.animal_id || '').localeCompare(b.animal_id || '');
      return cmp !== 0 ? cmp : (a.date || '').localeCompare(b.date || '');
    }),
    errors,
    source: 'json-files',
  };
}
