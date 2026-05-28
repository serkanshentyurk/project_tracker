/**
 * /api/settings — per-entity endpoint
 *
 * PUT  { projectId, settings, name? }   → update project settings, name, scan roots
 *
 * Copy to: src/routes/api/settings/+server.js
 */

import { json } from '@sveltejs/kit';
import { updateProjectSettings, updateProjectName, setScanRoots } from '$lib/server/db.js';

export async function PUT({ request }) {
  try {
    const { projectId, settings, name } = await request.json();
    if (!projectId) {
      return json({ ok: false, error: 'projectId required' }, { status: 400 });
    }

    if (settings) {
      await updateProjectSettings(projectId, settings);

    // Handle scan roots / processed_data_dir
    if (settings.processed_data_dir) {
        // Form field takes priority — this is what the user actually edited
        await setScanRoots(projectId, [{ path: settings.processed_data_dir, label: 'Default' }]);
    } else if (settings.scan_roots) {
        await setScanRoots(projectId, settings.scan_roots);
    }
    }

    if (name !== undefined) {
      await updateProjectName(projectId, name);
    }

    return json({ ok: true });
  } catch (e) {
    console.error('PUT /api/settings failed:', e);
    return json({ ok: false, error: String(e) }, { status: 500 });
  }
}
