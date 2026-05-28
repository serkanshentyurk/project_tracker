/**
 * /api/log — per-entity endpoint
 *
 * PUT    { projectId, entry }   → upsert one log entry
 * DELETE { projectId, id }      → delete one log entry
 *
 * Copy to: src/routes/api/log/+server.js
 */

import { json } from '@sveltejs/kit';
import { upsertLogEntry, deleteLogEntry } from '$lib/server/db.js';

export async function PUT({ request }) {
  try {
    const { projectId, entry } = await request.json();
    if (!projectId || !entry) {
      return json({ ok: false, error: 'projectId and entry required' }, { status: 400 });
    }
    await upsertLogEntry(projectId, entry);
    return json({ ok: true });
  } catch (e) {
    console.error('PUT /api/log failed:', e);
    return json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE({ request }) {
  try {
    const { projectId, id } = await request.json();
    if (!projectId || !id) {
      return json({ ok: false, error: 'projectId and id required' }, { status: 400 });
    }
    await deleteLogEntry(projectId, id);
    return json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/log failed:', e);
    return json({ ok: false, error: String(e) }, { status: 500 });
  }
}
