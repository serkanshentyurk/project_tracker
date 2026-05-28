/**
 * /api/data — backward-compatible data endpoint
 *
 * GET  → returns { currentProject, projects: [...] }
 *         assembled from PostgreSQL tables, same shape as before
 *
 * POST → accepts { currentProject, projects: [...] }
 *         decomposes into per-table writes
 *
 * This is the migration bridge. The frontend calls the same endpoints
 * as before. Eventually, individual write endpoints will replace POST.
 */

import { json } from '@sveltejs/kit';
import {
  readData,
  setMeta,
  readProject,
  createProject,
  updateProjectSettings,
  updateProjectName,
  deleteProject,
  upsertAim,
  deleteAim,
  upsertAnimal,
  deleteAnimal,
  upsertSession,
  deleteSession,
  upsertTransition,
  deleteTransition,
  upsertMilestonePhase,
  deleteMilestonePhase,
  upsertLogEntry,
  deleteLogEntry,
  upsertProtocol,
  deleteProtocol,
  upsertEvent,
  deleteEvent,
  setScanRoots,
  ensureInit,
  importProjectFromBlob,
  readProjectList,
} from '$lib/server/db.js';


export async function GET() {
  try {
    const data = await readData();
    return json(data);
  } catch (e) {
    console.error('GET /api/data failed:', e);
    return json({ error: String(e) }, { status: 500 });
  }
}


export async function POST({ request }) {
  try {
    const data = await request.json();
    await writeDataCompat(data);
    return json({ ok: true });
  } catch (e) {
    console.error('POST /api/data failed:', e);
    return json({ ok: false, error: String(e) }, { status: 500 });
  }
}


/**
 * Backward-compatible write: accepts the full blob and syncs each table.
 *
 * This is intentionally not optimal — it's a compatibility layer.
 * The proper approach is per-entity endpoints, which we'll add later.
 *
 * Strategy:
 *   1. Diff incoming projects against what's in the DB
 *   2. Delete projects that are gone
 *   3. For each incoming project, upsert every entity
 */
async function writeDataCompat(data) {
  await ensureInit();

  // Update current project pointer
  if (data.currentProject !== undefined) {
    await setMeta('currentProject', data.currentProject || '');
  }

  const incoming = data.projects || [];
  const incomingIds = new Set(incoming.map(p => p._id));

  // Delete removed projects
  const existing = await readProjectList();
  for (const { id } of existing) {
    if (!incomingIds.has(id)) {
      await deleteProject(id);
    }
  }

  // Upsert each project
  for (const proj of incoming) {
    const projectId = proj._id;
    const existingProj = await readProject(projectId);

    if (!existingProj) {
      // New project — full import
      await importProjectFromBlob(proj);
      continue;
    }

    // Existing project — update settings + entities
    const s = proj.settings || {};
    await updateProjectSettings(projectId, {
      project_full: s.project_full,
      supervisor: s.supervisor,
      committee: s.committee,
      hypothesis: s.hypothesis,
      today_month: s.today_month,
      gantt_total_months: s.gantt_total_months,
      gantt_start_year: s.gantt_start_year,
      config_yaml: s.config_yaml,
    });
    await updateProjectName(projectId, proj.name);

    // Scan roots
    if (s.scan_roots) {
      await setScanRoots(projectId, s.scan_roots);
    } else if (s.processed_data_dir) {
      await setScanRoots(projectId, [{ path: s.processed_data_dir, label: 'Default' }]);
    }

    // ── Sync aims ──
    const incomingAimIds = new Set(Object.keys(proj.aims || {}));
    const existingAimIds = new Set(Object.keys(existingProj.aims || {}));

    // Delete removed aims
    for (const aimId of existingAimIds) {
      if (!incomingAimIds.has(aimId)) await deleteAim(projectId, aimId);
    }
    // Upsert aims + trajectories
    for (const [aimId, aim] of Object.entries(proj.aims || {})) {
      const stages = (proj.trajectories || {})[aimId] || [];
      await upsertAim(projectId, aimId, aim, stages);
    }

    // ── Sync animals ──
    const incomingAnimalIds = new Set((proj.animals || []).map(a => a._id));
    const existingAnimalIds = new Set((existingProj.animals || []).map(a => a._id));

    for (const id of existingAnimalIds) {
      if (!incomingAnimalIds.has(id)) await deleteAnimal(projectId, id);
    }
    for (const animal of (proj.animals || [])) {
      await upsertAnimal(projectId, animal);
    }

    // ── Sync transitions (old "sessions") ──
    const incomingTransIds = new Set((proj.sessions || []).map(t => t._id));
    const existingTransIds = new Set((existingProj.sessions || []).map(t => t._id));

    for (const id of existingTransIds) {
      if (!incomingTransIds.has(id)) await deleteTransition(projectId, id);
    }
    for (const trans of (proj.sessions || [])) {
      await upsertTransition(projectId, trans);
    }

    // ── Sync behavioural sessions ──
    const incomingSessIds = new Set((proj.session_data || []).map(s => s._id));
    const existingSessIds = new Set((existingProj.session_data || []).map(s => s._id));

    for (const id of existingSessIds) {
      if (!incomingSessIds.has(id)) await deleteSession(projectId, id);
    }
    for (const sess of (proj.session_data || [])) {
      await upsertSession(projectId, sess);
    }

    // ── Sync milestones ──
    const incomingPhaseIds = new Set((proj.milestones || []).map(m => m.phase));
    const existingPhaseIds = new Set((existingProj.milestones || []).map(m => m.phase));

    for (const id of existingPhaseIds) {
      if (!incomingPhaseIds.has(id)) await deleteMilestonePhase(projectId, id);
    }
    for (let i = 0; i < (proj.milestones || []).length; i++) {
      await upsertMilestonePhase(projectId, proj.milestones[i], i);
    }

    // ── Sync log ──
    const incomingLogIds = new Set((proj.log || []).map(l => l.id));
    const existingLogIds = new Set((existingProj.log || []).map(l => l.id));

    for (const id of existingLogIds) {
      if (!incomingLogIds.has(id)) await deleteLogEntry(projectId, id);
    }
    for (const entry of (proj.log || [])) {
      await upsertLogEntry(projectId, entry);
    }

    // ── Sync protocols ──
    const incomingProtoIds = new Set((proj.protocols || []).map(p => p._id));
    const existingProtoIds = new Set((existingProj.protocols || []).map(p => p._id));

    for (const id of existingProtoIds) {
      if (!incomingProtoIds.has(id)) await deleteProtocol(projectId, id);
    }
    for (const proto of (proj.protocols || [])) {
      await upsertProtocol(projectId, proto);
    }

    // ── Sync events ──
    const incomingEventIds = new Set((proj.events || []).map(e => e._id));
    const existingEventIds = new Set((existingProj.events || []).map(e => e._id));

    for (const id of existingEventIds) {
      if (!incomingEventIds.has(id)) await deleteEvent(projectId, id);
    }
    for (const event of (proj.events || [])) {
      await upsertEvent(projectId, event);
    }
  }

  console.log(`[db] Synced ${incoming.length} project(s)`);
}
