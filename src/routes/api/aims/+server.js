/**
 * /api/aims — per-entity endpoint
 *
 * PUT    { projectId, aimId, aim, stages }   → upsert one aim + trajectory
 * DELETE { projectId, aimId }                → delete one aim (cascades trajectory)
 *
 * Copy to: src/routes/api/aims/+server.js
 */

import { json } from '@sveltejs/kit';
import { upsertAim, deleteAim } from '$lib/server/db.js';

export async function PUT({ request }) {
  try {
    const { projectId, aimId, aim, stages } = await request.json();
    if (!projectId || !aimId || !aim) {
      return json({ ok: false, error: 'projectId, aimId, and aim required' }, { status: 400 });
    }
    await upsertAim(projectId, aimId, aim, stages || []);
    return json({ ok: true });
  } catch (e) {
    console.error('PUT /api/aims failed:', e);
    return json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE({ request }) {
  try {
    const { projectId, aimId } = await request.json();
    if (!projectId || !aimId) {
      return json({ ok: false, error: 'projectId and aimId required' }, { status: 400 });
    }
    await deleteAim(projectId, aimId);
    return json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/aims failed:', e);
    return json({ ok: false, error: String(e) }, { status: 500 });
  }
}
