/**
 * /api/sessions — per-entity endpoint for behavioural sessions (session_data)
 *
 * PUT    { projectId, session }      → upsert one session
 * DELETE { projectId, id }           → delete one session
 * POST   { projectId, sessions }     → bulk upsert (for scan results)
 *
 * Copy to: src/routes/api/sessions/+server.js
 */

import { json } from '@sveltejs/kit';
import { upsertSession, deleteSession } from '$lib/server/db.js';

export async function PUT({ request }) {
  try {
    const { projectId, session } = await request.json();
    if (!projectId || !session) {
      return json({ ok: false, error: 'projectId and session required' }, { status: 400 });
    }
    await upsertSession(projectId, session);
    return json({ ok: true });
  } catch (e) {
    console.error('PUT /api/sessions failed:', e);
    return json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE({ request }) {
  try {
    const { projectId, id } = await request.json();
    if (!projectId || !id) {
      return json({ ok: false, error: 'projectId and id required' }, { status: 400 });
    }
    await deleteSession(projectId, id);
    return json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/sessions failed:', e);
    return json({ ok: false, error: String(e) }, { status: 500 });
  }
}

/** Bulk upsert — used after folder scan. */
export async function POST({ request }) {
  try {
    const { projectId, sessions } = await request.json();
    if (!projectId || !Array.isArray(sessions)) {
      return json({ ok: false, error: 'projectId and sessions[] required' }, { status: 400 });
    }
    let count = 0;
    for (const sess of sessions) {
      await upsertSession(projectId, sess);
      count++;
    }
    return json({ ok: true, count });
  } catch (e) {
    console.error('POST /api/sessions (bulk) failed:', e);
    return json({ ok: false, error: String(e) }, { status: 500 });
  }
}
