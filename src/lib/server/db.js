import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync, renameSync } from 'fs';
import { join } from 'path';
import { buildExampleProject } from '$lib/config.js';

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const DB_FILE = join(DATA_DIR, 'tracker.db');

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

let _db = null;

function getDb() {
  if (_db) return _db;
  ensureDir();
  _db = new Database(DB_FILE);
  _db.pragma('journal_mode = WAL');   // better concurrent read performance
  _db.pragma('foreign_keys = ON');

  // Create tables if they don't exist
  _db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS projects (
      _id   TEXT PRIMARY KEY,
      name  TEXT NOT NULL,
      data  TEXT NOT NULL
    );
  `);

  // Seed if empty
  const count = _db.prepare('SELECT COUNT(*) as n FROM projects').get();
  if (count.n === 0) {
    const seed = buildExampleProject();
    const { _id, name, ...rest } = seed;
    _db.prepare('INSERT INTO projects (_id, name, data) VALUES (?, ?, ?)').run(_id, name, JSON.stringify(rest));
    _db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('currentProject', _id);
  }

  return _db;
}

export function readData() {
  const db = getDb();
  const currentRow = db.prepare("SELECT value FROM meta WHERE key = 'currentProject'").get();
  const currentProject = currentRow?.value || null;
  const rows = db.prepare('SELECT _id, name, data FROM projects ORDER BY rowid').all();
  const projects = rows.map(r => {
    const parsed = JSON.parse(r.data);
    return { _id: r._id, name: r.name, ...parsed };
  });
  return { currentProject, projects };
}

export function writeData(data) {
  const db = getDb();

  const upsertProject = db.prepare(`
    INSERT INTO projects (_id, name, data) VALUES (?, ?, ?)
    ON CONFLICT(_id) DO UPDATE SET name = excluded.name, data = excluded.data
  `);
  const deleteProject = db.prepare('DELETE FROM projects WHERE _id = ?');
  const upsertMeta = db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)');

  const write = db.transaction(() => {
    // Determine which project IDs should exist
    const incomingIds = new Set((data.projects || []).map(p => p._id));

    // Remove projects no longer in the list
    const existingIds = db.prepare('SELECT _id FROM projects').all().map(r => r._id);
    for (const id of existingIds) {
      if (!incomingIds.has(id)) deleteProject.run(id);
    }

    // Upsert each project
    for (const proj of (data.projects || [])) {
      const { _id, name, ...rest } = proj;
      upsertProject.run(_id, name || 'Untitled', JSON.stringify(rest));
    }

    // Update current project pointer
    upsertMeta.run('currentProject', data.currentProject || '');
  });

  write();
}

// Migrate from old JSON file if it exists
export function migrateFromJSON() {
  const jsonPath = join(DATA_DIR, 'data.json');
  if (!existsSync(jsonPath)) return;

  try {
    const raw = readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(raw);

    if (data.projects) {
      writeData(data);
    } else if (data.animals) {
      const proj = {
        _id: 'proj_migrated', name: 'My Project',
        settings: data.settings || {}, aims: data.aims || {},
        trajectories: data.trajectories || {},
        animals: data.animals || [], sessions: data.sessions || [],
        milestones: data.milestones || [], log: data.log || [],
        protocols: data.protocols || [], events: data.events || [],
      };
      writeData({ currentProject: proj._id, projects: [proj] });
    }

    renameSync(jsonPath, jsonPath + '.migrated');
    console.log('Migrated data.json → SQLite');
  } catch (e) {
    console.error('Migration from data.json failed:', e);
  }
}
