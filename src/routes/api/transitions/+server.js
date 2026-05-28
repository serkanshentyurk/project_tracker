/**
 * /api/transitions — per-entity endpoint
 *
 * PUT    { projectId, transition }   → upsert one transition
 * DELETE { projectId, id }           → delete one transition
 *
 * Copy to: src/routes/api/transitions/+server.js
 */

import { json } from '@sveltejs/kit';
import { upsertTransition, deleteTransition } from '$lib/server/db.js';

export async function PUT({ request }) {
  try {
    const { projectId, transition } = await request.json();
    if (!projectId || !transition) {
      return json({ ok: false, error: 'projectId and transition required' }, { status: 400 });
    }
    await upsertTransition(projectId, transition);
    return json({ ok: true });
  } catch (e) {
    console.error('PUT /api/transitions failed:', e);
    return json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE({ request }) {
  try {
    const { projectId, id } = await request.json();
    if (!projectId || !id) {
      return json({ ok: false, error: 'projectId and id required' }, { status: 400 });
    }
    await deleteTransition(projectId, id);
    return json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/transitions failed:', e);
    return json({ ok: false, error: String(e) }, { status: 500 });
  }
}
