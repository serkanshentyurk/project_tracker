/**
 * /api/project — project-level operations
 *
 * POST   { project }                   → create new project
 * DELETE { projectId }                  → delete project
 * PUT    { action: 'switch', id }       → switch current project
 * PUT    { action: 'import', project }  → import full project blob (reset / import)
 *
 * Copy to: src/routes/api/project/+server.js
 */

import { json } from '@sveltejs/kit';
import {
  createProject,
  deleteProject,
  setMeta,
  importProjectFromBlob,
} from '$lib/server/db.js';

export async function POST({ request }) {
  try {
    const { project } = await request.json();
    if (!project || !project._id) {
      return json({ ok: false, error: 'project with _id required' }, { status: 400 });
    }
    await createProject({
      id: project._id,
      name: project.name || 'New Project',
      project_full: project.settings?.project_full || '',
      supervisor: project.settings?.supervisor || '',
      committee: project.settings?.committee || [],
      hypothesis: project.settings?.hypothesis || '',
      gantt_today_month: project.settings?.today_month || 1,
      gantt_total_months: project.settings?.gantt_total_months || 36,
      gantt_start_year: project.settings?.gantt_start_year || 2026,
    });
    await setMeta('currentProject', project._id);
    return json({ ok: true });
  } catch (e) {
    console.error('POST /api/project failed:', e);
    return json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE({ request }) {
  try {
    const { projectId } = await request.json();
    if (!projectId) {
      return json({ ok: false, error: 'projectId required' }, { status: 400 });
    }
    await deleteProject(projectId);
    return json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/project failed:', e);
    return json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function PUT({ request }) {
  try {
    const body = await request.json();

    if (body.action === 'switch') {
      if (!body.id) return json({ ok: false, error: 'id required' }, { status: 400 });
      await setMeta('currentProject', body.id);
      return json({ ok: true });
    }

    if (body.action === 'import') {
      if (!body.project) return json({ ok: false, error: 'project required' }, { status: 400 });
      // Delete existing project if re-importing (reset)
      try { await deleteProject(body.project._id); } catch { /* may not exist */ }
      await importProjectFromBlob(body.project);
      return json({ ok: true });
    }

    return json({ ok: false, error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    console.error('PUT /api/project failed:', e);
    return json({ ok: false, error: String(e) }, { status: 500 });
  }
}
