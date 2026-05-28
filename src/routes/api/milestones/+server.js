/**
 * /api/milestones — per-entity endpoint
 *
 * PUT  { projectId, milestones }   → replace all milestone phases + items
 *
 * Milestones are positional arrays with nested items, so we replace the
 * entire set rather than doing individual upserts. Still far better than
 * sending every entity in the project.
 *
 * Copy to: src/routes/api/milestones/+server.js
 */

import { json } from '@sveltejs/kit';
import {
  upsertMilestonePhase,
  deleteMilestonePhase,
  readProject,
} from '$lib/server/db.js';

export async function PUT({ request }) {
  try {
    const { projectId, milestones } = await request.json();
    if (!projectId || !Array.isArray(milestones)) {
      return json({ ok: false, error: 'projectId and milestones[] required' }, { status: 400 });
    }

    // Read existing to find phases to delete
    const existing = await readProject(projectId);
    const incomingIds = new Set(milestones.map(m => m.phase || m.id));
    for (const m of (existing?.milestones || [])) {
      if (!incomingIds.has(m.phase)) {
        await deleteMilestonePhase(projectId, m.phase);
      }
    }

    // Upsert all incoming
    for (let i = 0; i < milestones.length; i++) {
      await upsertMilestonePhase(projectId, milestones[i], i);
    }

    return json({ ok: true });
  } catch (e) {
    console.error('PUT /api/milestones failed:', e);
    return json({ ok: false, error: String(e) }, { status: 500 });
  }
}
