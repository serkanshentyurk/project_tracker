/**
 * /api/animals — per-entity endpoint
 *
 * PUT    { projectId, animal }   → upsert one animal
 * DELETE { projectId, id }       → delete one animal
 *
 * Copy to: src/routes/api/animals/+server.js
 */

import { json } from '@sveltejs/kit';
import { upsertAnimal, deleteAnimal } from '$lib/server/db.js';

export async function PUT({ request }) {
  try {
    const { projectId, animal } = await request.json();
    if (!projectId || !animal) {
      return json({ ok: false, error: 'projectId and animal required' }, { status: 400 });
    }
    await upsertAnimal(projectId, animal);
    return json({ ok: true });
  } catch (e) {
    console.error('PUT /api/animals failed:', e);
    return json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE({ request }) {
  try {
    const { projectId, id } = await request.json();
    if (!projectId || !id) {
      return json({ ok: false, error: 'projectId and id required' }, { status: 400 });
    }
    await deleteAnimal(projectId, id);
    return json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/animals failed:', e);
    return json({ ok: false, error: String(e) }, { status: 500 });
  }
}
