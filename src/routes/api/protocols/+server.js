/**
 * /api/protocols — per-entity endpoint
 *
 * PUT    { projectId, protocol }   → upsert one protocol (incl. items)
 * DELETE { projectId, id }         → delete one protocol
 *
 * Copy to: src/routes/api/protocols/+server.js
 */

import { json } from '@sveltejs/kit';
import { upsertProtocol, deleteProtocol } from '$lib/server/db.js';

export async function PUT({ request }) {
  try {
    const { projectId, protocol } = await request.json();
    if (!projectId || !protocol) {
      return json({ ok: false, error: 'projectId and protocol required' }, { status: 400 });
    }
    await upsertProtocol(projectId, protocol);
    return json({ ok: true });
  } catch (e) {
    console.error('PUT /api/protocols failed:', e);
    return json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE({ request }) {
  try {
    const { projectId, id } = await request.json();
    if (!projectId || !id) {
      return json({ ok: false, error: 'projectId and id required' }, { status: 400 });
    }
    await deleteProtocol(projectId, id);
    return json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/protocols failed:', e);
    return json({ ok: false, error: String(e) }, { status: 500 });
  }
}
