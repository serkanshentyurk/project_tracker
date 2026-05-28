/**
 * /api/events — per-entity endpoint
 *
 * PUT    { projectId, event }   → upsert one event
 * DELETE { projectId, id }      → delete one event
 *
 * Copy to: src/routes/api/events/+server.js
 */

import { json } from '@sveltejs/kit';
import { upsertEvent, deleteEvent } from '$lib/server/db.js';

export async function PUT({ request }) {
  try {
    const { projectId, event } = await request.json();
    if (!projectId || !event) {
      return json({ ok: false, error: 'projectId and event required' }, { status: 400 });
    }
    await upsertEvent(projectId, event);
    return json({ ok: true });
  } catch (e) {
    console.error('PUT /api/events failed:', e);
    return json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE({ request }) {
  try {
    const { projectId, id } = await request.json();
    if (!projectId || !id) {
      return json({ ok: false, error: 'projectId and id required' }, { status: 400 });
    }
    await deleteEvent(projectId, id);
    return json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/events failed:', e);
    return json({ ok: false, error: String(e) }, { status: 500 });
  }
}
