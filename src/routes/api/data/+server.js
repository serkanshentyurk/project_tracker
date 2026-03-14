import { json } from '@sveltejs/kit';
import { readData, writeData, migrateFromJSON } from '$lib/server/db.js';

// Run once on first request — migrates old data.json if present
let _migrated = false;
function ensureMigrated() {
  if (!_migrated) { migrateFromJSON(); _migrated = true; }
}

export function GET() {
  ensureMigrated();
  return json(readData());
}

export async function POST({ request }) {
  const data = await request.json();
  writeData(data);
  return json({ ok: true });
}
