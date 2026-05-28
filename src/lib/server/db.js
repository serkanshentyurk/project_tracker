/**
 * Database layer — PostgreSQL
 *
 * Design:
 *   - readProject(id)  → assembles full project from tables (same shape frontend expects)
 *   - readAllProjects() → list of {id, name} for sidebar
 *   - Per-entity CRUD  → individual inserts/updates/deletes
 *
 * The read side returns the same data shape as the old JSON blob,
 * so the frontend stores need minimal changes. The write side is
 * granular — no more "save entire project on every keystroke".
 *
 * Environment:
 *   DATABASE_URL — PostgreSQL connection string
 *   e.g. postgres://user:pass@host:5432/labtracker
 */

import pg from 'pg';
const { Pool } = pg;

// Return DATE columns as plain strings — prevents timezone-shifting
pg.types.setTypeParser(1082, val => val);

// ── Connection ───────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL || '';

let _pool = null;

function getPool() {
  if (_pool) return _pool;
  if (!DATABASE_URL) {
    throw new Error(
      'DATABASE_URL not set. Set it to a PostgreSQL connection string.\n'
      + 'e.g. postgres://user:pass@localhost:5432/labtracker'
    );
  }
  _pool = new Pool({
    connectionString: DATABASE_URL,
    max: 10,
    ssl: DATABASE_URL.includes('render.com') || DATABASE_URL.includes('neon.tech')
      ? { rejectUnauthorized: false }
      : undefined,
  });
  return _pool;
}

/** Run a query. Returns { rows, rowCount }. */
async function query(sql, params = []) {
  const pool = getPool();
  return pool.query(sql, params);
}

/** Run a query, return first row or null. */
async function queryOne(sql, params = []) {
  const { rows } = await query(sql, params);
  return rows[0] || null;
}


/** Format a PostgreSQL DATE value to 'YYYY-MM-DD' string. */
function fmtDate(val) {
  if (!val) return val;
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  if (typeof val === 'string' && val.includes('T')) {
    return val.split('T')[0];
  }
  return val;
}


// ── Schema Initialisation ────────────────────────────────────────────────────

let _initialized = false;

export async function ensureInit() {
  if (_initialized) return;
  const pool = getPool();

  // Run schema creation (idempotent with IF NOT EXISTS)
  // In production, use a migration tool. For now, inline the essentials.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY, value TEXT
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT 'New Project',
      project_full TEXT DEFAULT '', supervisor TEXT DEFAULT '',
      committee JSONB DEFAULT '[]', hypothesis TEXT DEFAULT '',
      gantt_today_month INT DEFAULT 1, gantt_total_months INT DEFAULT 36,
      gantt_start_year INT DEFAULT 2026, config_yaml TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS scan_roots (
      id SERIAL PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      path TEXT NOT NULL, label TEXT DEFAULT '', auto_scan BOOLEAN DEFAULT FALSE,
      scan_interval_min INT DEFAULT 30, last_scanned_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS aims (
      id TEXT NOT NULL, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      label TEXT NOT NULL, title TEXT DEFAULT '', description TEXT DEFAULT '',
      color TEXT DEFAULT '#3b82f6', tools JSONB DEFAULT '[]', sort_order INT DEFAULT 0,
      PRIMARY KEY (project_id, id)
    );
    CREATE TABLE IF NOT EXISTS trajectory_stages (
      project_id TEXT NOT NULL, aim_id TEXT NOT NULL, id TEXT NOT NULL,
      label TEXT NOT NULL, short TEXT DEFAULT '', type TEXT DEFAULT 'behaviour',
      sort_order INT NOT NULL DEFAULT 0,
      PRIMARY KEY (project_id, aim_id, id),
      FOREIGN KEY (project_id, aim_id) REFERENCES aims(project_id, id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS animals (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      track_id TEXT NOT NULL, lab_id TEXT DEFAULT '', cage TEXT DEFAULT '',
      sex TEXT DEFAULT '', aim_id TEXT, strain TEXT DEFAULT '', mutation1 TEXT DEFAULT '',
      dob DATE, hp_date DATE, wr_start DATE, train_start DATE,
      surgery_date DATE, aav_date DATE, window_grade TEXT DEFAULT '',
      gcamp TEXT DEFAULT '', opto_batch TEXT DEFAULT '',
      current_stage TEXT DEFAULT '', stage_dates JSONB DEFAULT '{}',
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      animal_id TEXT REFERENCES animals(id) ON DELETE SET NULL,
      animal_track_id TEXT NOT NULL, date DATE NOT NULL,
      stage TEXT DEFAULT '', distribution TEXT DEFAULT '',
      folder TEXT DEFAULT '', source TEXT DEFAULT 'scan',
      stats JSONB DEFAULT '{}', pdfs JSONB DEFAULT '[]',
      raw_csv_path TEXT DEFAULT '', notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS transitions (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      animal_id TEXT REFERENCES animals(id) ON DELETE SET NULL,
      date DATE NOT NULL, stage_from TEXT DEFAULT '', stage_to TEXT NOT NULL,
      notes TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS milestone_phases (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      label TEXT NOT NULL, color TEXT DEFAULT '#3b82f6',
      gantt_start INT, gantt_end INT, gantt_rows JSONB DEFAULT '[]',
      sort_order INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS milestone_items (
      id TEXT PRIMARY KEY, phase_id TEXT NOT NULL REFERENCES milestone_phases(id) ON DELETE CASCADE,
      text TEXT NOT NULL, status TEXT DEFAULT 'todo',
      is_milestone BOOLEAN DEFAULT FALSE, deadline DATE, deadline_month INT,
      sort_order INT DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS log_entries (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      date DATE, kind TEXT NOT NULL DEFAULT 'issue', status TEXT DEFAULT 'open',
      title TEXT NOT NULL, body TEXT DEFAULT '', risks TEXT DEFAULT '',
      priority TEXT, deadline DATE, resolved_date DATE, resolution TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS protocols (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL, aim_id TEXT DEFAULT '', steps TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS protocol_items (
      id TEXT PRIMARY KEY, protocol_id TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
      text TEXT NOT NULL, status TEXT DEFAULT 'todo', sort_order INT DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL, date DATE NOT NULL, type TEXT DEFAULT 'custom',
      notes TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT DEFAULT '',
      password_hash TEXT NOT NULL, role TEXT DEFAULT 'editor',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Create indexes (safe to re-run)
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_scan_roots_project ON scan_roots(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_animals_project ON animals(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_animal ON sessions(animal_id)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(project_id, date)',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_dedup ON sessions(project_id, animal_track_id, date)',
    'CREATE INDEX IF NOT EXISTS idx_transitions_project ON transitions(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_log_project ON log_entries(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestone_phases(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_protocols_project ON protocols(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id)',
  ];
  for (const idx of indexes) {
    try { await pool.query(idx); } catch { /* index may already exist */ }
  }

  _initialized = true;
  console.log('[db] PostgreSQL schema initialised');
}


// =============================================================================
// META
// =============================================================================

export async function getMeta(key) {
  await ensureInit();
  const row = await queryOne('SELECT value FROM meta WHERE key = $1', [key]);
  return row?.value || null;
}

export async function setMeta(key, value) {
  await ensureInit();
  await query(
    `INSERT INTO meta (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = $2`,
    [key, value]
  );
}


// =============================================================================
// PROJECT — READ (assembles full project in the old shape)
// =============================================================================

export async function readProjectList() {
  await ensureInit();
  const { rows } = await query('SELECT id, name FROM projects ORDER BY created_at');
  return rows;
}

/**
 * Assemble a full project object matching the shape the frontend expects.
 * This is the compatibility layer — the frontend doesn't need to know
 * data comes from multiple tables.
 */
export async function readProject(projectId) {
  await ensureInit();

  const proj = await queryOne('SELECT * FROM projects WHERE id = $1', [projectId]);
  if (!proj) return null;

  // Aims → { A1: { label, title, ... }, A2: { ... } }
  const { rows: aimRows } = await query(
    'SELECT * FROM aims WHERE project_id = $1 ORDER BY sort_order, id', [projectId]
  );
  const aims = {};
  for (const a of aimRows) {
    aims[a.id] = {
      label: a.label, title: a.title, description: a.description,
      color: a.color, tools: a.tools || [],
    };
  }

  // Trajectories → { A1: [{id, label, short, type}, ...], ... }
  const { rows: stageRows } = await query(
    'SELECT * FROM trajectory_stages WHERE project_id = $1 ORDER BY aim_id, sort_order',
    [projectId]
  );
  const trajectories = {};
  for (const s of stageRows) {
    if (!trajectories[s.aim_id]) trajectories[s.aim_id] = [];
    trajectories[s.aim_id].push({
      id: s.id, label: s.label, short: s.short, type: s.type,
    });
  }

  // Animals
  const { rows: animalRows } = await query(
    'SELECT * FROM animals WHERE project_id = $1 ORDER BY track_id', [projectId]
  );
  const animals = animalRows.map(a => ({
    _id: a.id, track_id: a.track_id, lab_id: a.lab_id, cage: a.cage,
    sex: a.sex, aim: a.aim_id, strain: a.strain, mutation1: a.mutation1,
    dob: fmtDate(a.dob), hp_date: fmtDate(a.hp_date), wr_start: fmtDate(a.wr_start),
    train_start: fmtDate(a.train_start), surgery_date: fmtDate(a.surgery_date),
    aav_date: fmtDate(a.aav_date), window_grade: a.window_grade, gcamp: a.gcamp,
    opto_batch: a.opto_batch, current_stage: a.current_stage,
    stage_dates: a.stage_dates || {}, notes: a.notes,
  }));

  // Transitions (old "sessions" in the frontend)
  const { rows: transRows } = await query(
    'SELECT * FROM transitions WHERE project_id = $1 ORDER BY date DESC', [projectId]
  );
  const sessions = transRows.map(t => ({
    _id: t.id, animal_id: t.animal_id, date: fmtDate(t.date),
    stage_from: t.stage_from, stage_to: t.stage_to, notes: t.notes,
  }));

  // Behavioural sessions (session_data in the frontend)
  const { rows: sessRows } = await query(
    'SELECT * FROM sessions WHERE project_id = $1 ORDER BY animal_track_id, date', [projectId]
  );
  const session_data = sessRows.map(s => ({
    _id: s.id, animal_id: s.animal_track_id, date: fmtDate(s.date),
    stage: s.stage, distribution: s.distribution, folder: s.folder,
    pdfs: s.pdfs || [], metrics: s.stats || {}, source: s.source,
    notes: s.notes,
  }));

  // Milestones (phases + items)
  const { rows: phaseRows } = await query(
    'SELECT * FROM milestone_phases WHERE project_id = $1 ORDER BY sort_order', [projectId]
  );
  const milestones = [];
  for (const p of phaseRows) {
    const { rows: itemRows } = await query(
      'SELECT * FROM milestone_items WHERE phase_id = $1 ORDER BY sort_order', [p.id]
    );
    milestones.push({
      phase: p.id, label: p.label, color: p.color,
      gantt_start: p.gantt_start, gantt_end: p.gantt_end,
      gantt_rows: p.gantt_rows || [],
      items: itemRows.map(i => ({
        id: i.id, text: i.text, status: i.status,
        milestone: i.is_milestone, deadline: fmtDate(i.deadline),
        deadline_month: i.deadline_month,
      })),
    });
  }

  // Log
  const { rows: logRows } = await query(
    'SELECT * FROM log_entries WHERE project_id = $1 ORDER BY date DESC', [projectId]
  );
  const log = logRows.map(l => ({
    id: l.id, date: fmtDate(l.date), kind: l.kind, status: l.status,
    title: l.title, body: l.body, risks: l.risks, priority: l.priority,
    deadline: fmtDate(l.deadline), resolved_date: fmtDate(l.resolved_date), resolution: l.resolution,
  }));

  // Protocols
  const { rows: protoRows } = await query(
    'SELECT * FROM protocols WHERE project_id = $1 ORDER BY title', [projectId]
  );
  const protocols = [];
  for (const p of protoRows) {
    const { rows: piRows } = await query(
      'SELECT * FROM protocol_items WHERE protocol_id = $1 ORDER BY sort_order', [p.id]
    );
    protocols.push({
      _id: p.id, title: p.title, aim: p.aim_id, steps: p.steps,
      items: piRows.map(i => ({ id: i.id, text: i.text, status: i.status })),
    });
  }

  // Events
  const { rows: eventRows } = await query(
    'SELECT * FROM events WHERE project_id = $1 ORDER BY date', [projectId]
  );
  const events = eventRows.map(e => ({
    _id: e.id, title: e.title, date: fmtDate(e.date), type: e.type, notes: e.notes,
  }));

  // Scan roots
  const { rows: scanRows } = await query(
    'SELECT * FROM scan_roots WHERE project_id = $1 ORDER BY id', [projectId]
  );

  // Assemble in the old shape
  return {
    _id: proj.id,
    name: proj.name,
    settings: {
      today_month: proj.gantt_today_month,
      gantt_total_months: proj.gantt_total_months,
      gantt_start_year: proj.gantt_start_year,
      project_full: proj.project_full,
      supervisor: proj.supervisor,
      committee: proj.committee || [],
      hypothesis: proj.hypothesis,
      config_yaml: proj.config_yaml,
      processed_data_dir: scanRows[0]?.path || '',    
      scan_roots: scanRows.map(r => ({
        id: r.id, path: r.path, label: r.label,
        auto_scan: r.auto_scan, scan_interval_min: r.scan_interval_min,
      })),
    },
    aims,
    trajectories,
    animals,
    sessions,       // transitions (stage changes)
    session_data,   // behavioural sessions with metrics
    milestones,
    log,
    protocols,
    events,
  };
}

/**
 * Read full data payload (all projects + current project ID).
 * Compatible with the old GET /api/data response shape.
 */
export async function readData() {
  await ensureInit();
  const currentProject = await getMeta('currentProject');
  const projectList = await readProjectList();

  const projects = [];
  for (const { id } of projectList) {
    const proj = await readProject(id);
    if (proj) projects.push(proj);
  }

  return { currentProject, projects };
}


// =============================================================================
// PROJECT — WRITE (per-entity operations)
// =============================================================================

// ── Project ──────────────────────────────────────────────────────────────────

export async function createProject(proj) {
  await ensureInit();
  await query(
    `INSERT INTO projects (id, name, project_full, supervisor, committee,
       hypothesis, gantt_today_month, gantt_total_months, gantt_start_year,
       config_yaml)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      proj.id, proj.name, proj.project_full || '', proj.supervisor || '',
      JSON.stringify(proj.committee || []), proj.hypothesis || '',
      proj.gantt_today_month || 1, proj.gantt_total_months || 36,
      proj.gantt_start_year || 2026, proj.config_yaml || null,
    ]
  );
}

export async function updateProjectSettings(projectId, settings) {
  await ensureInit();
  await query(
    `UPDATE projects SET
       project_full = $2, supervisor = $3, committee = $4, hypothesis = $5,
       gantt_today_month = $6, gantt_total_months = $7, gantt_start_year = $8,
       config_yaml = $9, updated_at = NOW()
     WHERE id = $1`,
    [
      projectId, settings.project_full || '', settings.supervisor || '',
      JSON.stringify(settings.committee || []), settings.hypothesis || '',
      settings.today_month || 1, settings.gantt_total_months || 36,
      settings.gantt_start_year || 2026, settings.config_yaml || null,
    ]
  );
}

export async function updateProjectName(projectId, name) {
  await ensureInit();
  await query('UPDATE projects SET name = $2, updated_at = NOW() WHERE id = $1',
    [projectId, name]);
}

export async function deleteProject(projectId) {
  await ensureInit();
  await query('DELETE FROM projects WHERE id = $1', [projectId]);
}

// ── Aims + Trajectories ─────────────────────────────────────────────────────

export async function upsertAim(projectId, aimId, aim, stages = []) {
  await ensureInit();
  await query(
    `INSERT INTO aims (project_id, id, label, title, description, color, tools, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (project_id, id) DO UPDATE SET
       label=$3, title=$4, description=$5, color=$6, tools=$7, sort_order=$8`,
    [
      projectId, aimId, aim.label, aim.title || '', aim.description || '',
      aim.color || '#3b82f6', JSON.stringify(aim.tools || []), aim.sort_order || 0,
    ]
  );

  // Replace trajectory stages
  await query(
    'DELETE FROM trajectory_stages WHERE project_id = $1 AND aim_id = $2',
    [projectId, aimId]
  );
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i];
    await query(
      `INSERT INTO trajectory_stages (project_id, aim_id, id, label, short, type, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [projectId, aimId, s.id, s.label, s.short || '', s.type || 'behaviour', i]
    );
  }
}

export async function deleteAim(projectId, aimId) {
  await ensureInit();
  await query('DELETE FROM aims WHERE project_id = $1 AND id = $2', [projectId, aimId]);
}

// ── Animals ──────────────────────────────────────────────────────────────────

export async function upsertAnimal(projectId, animal) {
  await ensureInit();
  const id = animal._id || animal.id;
  await query(
    `INSERT INTO animals (id, project_id, track_id, lab_id, cage, sex, aim_id,
       strain, mutation1, dob, hp_date, wr_start, train_start, surgery_date,
       aav_date, window_grade, gcamp, opto_batch, current_stage, stage_dates, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
     ON CONFLICT (id) DO UPDATE SET
       track_id=$3, lab_id=$4, cage=$5, sex=$6, aim_id=$7, strain=$8, mutation1=$9,
       dob=$10, hp_date=$11, wr_start=$12, train_start=$13, surgery_date=$14,
       aav_date=$15, window_grade=$16, gcamp=$17, opto_batch=$18,
       current_stage=$19, stage_dates=$20, notes=$21, updated_at=NOW()`,
    [
      id, projectId, animal.track_id, animal.lab_id || '', animal.cage || '',
      animal.sex || '', animal.aim || animal.aim_id || null,
      animal.strain || '', animal.mutation1 || '',
      animal.dob || null, animal.hp_date || null, animal.wr_start || null,
      animal.train_start || null, animal.surgery_date || null,
      animal.aav_date || null, animal.window_grade || '',
      animal.gcamp || '', animal.opto_batch || '',
      animal.current_stage || '', JSON.stringify(animal.stage_dates || {}),
      animal.notes || '',
    ]
  );
}

export async function deleteAnimal(projectId, animalId) {
  await ensureInit();
  await query('DELETE FROM animals WHERE id = $1 AND project_id = $2', [animalId, projectId]);
}

// ── Sessions (behavioural) ───────────────────────────────────────────────────

export async function upsertSession(projectId, session) {
  await ensureInit();
  const id = session._id || session.id;
  // Look up animal record ID from track_id
  const animal = await queryOne(
    'SELECT id FROM animals WHERE project_id = $1 AND track_id = $2',
    [projectId, session.animal_id]
  );
  // Remove any existing row with same animal+date but different ID (dedup)
  await query(
    'DELETE FROM sessions WHERE project_id = $1 AND animal_track_id = $2 AND date = $3 AND id != $4',
    [projectId, session.animal_id, session.date, id]
  );
  await query(
    `INSERT INTO sessions (id, project_id, animal_id, animal_track_id, date,
       stage, distribution, folder, source, stats, pdfs, raw_csv_path, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (id) DO UPDATE SET
       stats=$10, notes=$13`,
    [
      id, projectId, animal?.id || null, session.animal_id, session.date,
      session.stage || '', session.distribution || '', session.folder || '',
      session.source || 'scan', JSON.stringify(session.metrics || session.stats || {}),
      JSON.stringify(session.pdfs || []), session.raw_csv_path || '',
      session.notes || '',
    ]
  );
}

export async function deleteSession(projectId, sessionId) {
  await ensureInit();
  await query('DELETE FROM sessions WHERE id = $1 AND project_id = $2', [sessionId, projectId]);
}

// ── Transitions ──────────────────────────────────────────────────────────────

export async function upsertTransition(projectId, trans) {
  await ensureInit();
  const id = trans._id || trans.id;
  await query(
    `INSERT INTO transitions (id, project_id, animal_id, date, stage_from, stage_to, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (id) DO UPDATE SET
       date=$4, stage_from=$5, stage_to=$6, notes=$7`,
    [id, projectId, trans.animal_id, trans.date, trans.stage_from || '', trans.stage_to, trans.notes || '']
  );
}

export async function deleteTransition(projectId, transId) {
  await ensureInit();
  await query('DELETE FROM transitions WHERE id = $1 AND project_id = $2', [transId, projectId]);
}

// ── Milestones ───────────────────────────────────────────────────────────────

export async function upsertMilestonePhase(projectId, phase, idx = 0) {
  await ensureInit();
  const id = phase.phase || phase.id;
  await query(
    `INSERT INTO milestone_phases (id, project_id, label, color, gantt_start, gantt_end, gantt_rows, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (id) DO UPDATE SET
       label=$3, color=$4, gantt_start=$5, gantt_end=$6, gantt_rows=$7, sort_order=$8`,
    [id, projectId, phase.label, phase.color || '#3b82f6',
     phase.gantt_start || null, phase.gantt_end || null,
     JSON.stringify(phase.gantt_rows || []), idx]
  );

  // Replace items
  await query('DELETE FROM milestone_items WHERE phase_id = $1', [id]);
  for (let i = 0; i < (phase.items || []).length; i++) {
    const item = phase.items[i];
    await query(
      `INSERT INTO milestone_items (id, phase_id, text, status, is_milestone, deadline, deadline_month, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [item.id, id, item.text, item.status || 'todo', item.milestone || false,
       item.deadline || null, item.deadline_month || null, i]
    );
  }
}

export async function deleteMilestonePhase(projectId, phaseId) {
  await ensureInit();
  await query('DELETE FROM milestone_phases WHERE id = $1 AND project_id = $2', [phaseId, projectId]);
}

// ── Log Entries ──────────────────────────────────────────────────────────────

export async function upsertLogEntry(projectId, entry) {
  await ensureInit();
  const id = entry.id;
  await query(
    `INSERT INTO log_entries (id, project_id, date, kind, status, title, body,
       risks, priority, deadline, resolved_date, resolution)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (id) DO UPDATE SET
       date=$3, kind=$4, status=$5, title=$6, body=$7, risks=$8,
       priority=$9, deadline=$10, resolved_date=$11, resolution=$12, updated_at=NOW()`,
    [
      id, projectId, entry.date || null, entry.kind, entry.status || 'open',
      entry.title, entry.body || '', entry.risks || '', entry.priority || null,
      entry.deadline || null, entry.resolved_date || null, entry.resolution || '',
    ]
  );
}

export async function deleteLogEntry(projectId, entryId) {
  await ensureInit();
  await query('DELETE FROM log_entries WHERE id = $1 AND project_id = $2', [entryId, projectId]);
}

// ── Protocols ────────────────────────────────────────────────────────────────

export async function upsertProtocol(projectId, proto) {
  await ensureInit();
  const id = proto._id || proto.id;
  await query(
    `INSERT INTO protocols (id, project_id, title, aim_id, steps)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (id) DO UPDATE SET
       title=$3, aim_id=$4, steps=$5, updated_at=NOW()`,
    [id, projectId, proto.title, proto.aim || '', proto.steps || '']
  );

  // Replace items
  await query('DELETE FROM protocol_items WHERE protocol_id = $1', [id]);
  for (let i = 0; i < (proto.items || []).length; i++) {
    const item = proto.items[i];
    await query(
      `INSERT INTO protocol_items (id, protocol_id, text, status, sort_order)
       VALUES ($1,$2,$3,$4,$5)`,
      [item.id, id, item.text, item.status || 'todo', i]
    );
  }
}

export async function deleteProtocol(projectId, protoId) {
  await ensureInit();
  await query('DELETE FROM protocols WHERE id = $1 AND project_id = $2', [protoId, projectId]);
}

// ── Events ───────────────────────────────────────────────────────────────────

export async function upsertEvent(projectId, event) {
  await ensureInit();
  const id = event._id || event.id;
  await query(
    `INSERT INTO events (id, project_id, title, date, type, notes)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (id) DO UPDATE SET
       title=$3, date=$4, type=$5, notes=$6`,
    [id, projectId, event.title, event.date, event.type || 'custom', event.notes || '']
  );
}

export async function deleteEvent(projectId, eventId) {
  await ensureInit();
  await query('DELETE FROM events WHERE id = $1 AND project_id = $2', [eventId, projectId]);
}

// ── Scan Roots ───────────────────────────────────────────────────────────────

export async function setScanRoots(projectId, roots) {
  await ensureInit();
  await query('DELETE FROM scan_roots WHERE project_id = $1', [projectId]);
  for (const r of roots) {
    await query(
      `INSERT INTO scan_roots (project_id, path, label, auto_scan, scan_interval_min)
       VALUES ($1,$2,$3,$4,$5)`,
      [projectId, r.path, r.label || '', r.auto_scan || false, r.scan_interval_min || 30]
    );
  }
}

export async function getScanRoots(projectId) {
  await ensureInit();
  const { rows } = await query(
    'SELECT * FROM scan_roots WHERE project_id = $1 ORDER BY id', [projectId]
  );
  return rows;
}


// =============================================================================
// MIGRATION: Import old JSON blob format into new tables
// =============================================================================

/**
 * Import a project from the old JSON blob format.
 * Used during migration from SQLite/Turso and for JSON import.
 */
export async function importProjectFromBlob(proj) {
  await ensureInit();
  const id = proj._id;
  const s = proj.settings || {};

  // Project
  await createProject({
    id, name: proj.name, project_full: s.project_full,
    supervisor: s.supervisor, committee: s.committee,
    hypothesis: s.hypothesis, gantt_today_month: s.today_month,
    gantt_total_months: s.gantt_total_months,
    gantt_start_year: s.gantt_start_year,
    config_yaml: s.config_yaml,
  });

  // Scan roots (from old processed_data_dir)
  if (s.processed_data_dir) {
    await setScanRoots(id, [{ path: s.processed_data_dir, label: 'Legacy' }]);
  }

  // Aims + trajectories
  for (const [aimId, aim] of Object.entries(proj.aims || {})) {
    const stages = (proj.trajectories || {})[aimId] || [];
    await upsertAim(id, aimId, aim, stages);
  }

  // Animals
  for (const animal of (proj.animals || [])) {
    await upsertAnimal(id, animal);
  }

  // Transitions (old "sessions")
  for (const trans of (proj.sessions || [])) {
    await upsertTransition(id, trans);
  }

  // Behavioural sessions
  for (const sess of (proj.session_data || [])) {
    await upsertSession(id, sess);
  }

  // Milestones
  for (let i = 0; i < (proj.milestones || []).length; i++) {
    await upsertMilestonePhase(id, proj.milestones[i], i);
  }

  // Log
  for (const entry of (proj.log || [])) {
    await upsertLogEntry(id, entry);
  }

  // Protocols
  for (const proto of (proj.protocols || [])) {
    await upsertProtocol(id, proto);
  }

  // Events
  for (const event of (proj.events || [])) {
    await upsertEvent(id, event);
  }

  console.log(`[db] Imported project "${proj.name}" (${id})`);
}

/**
 * Full migration: reads old JSON export and imports all projects.
 */
export async function migrateFromJSON(jsonData) {
  await ensureInit();
  const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

  for (const proj of (data.projects || [])) {
    await importProjectFromBlob(proj);
  }

  if (data.currentProject) {
    await setMeta('currentProject', data.currentProject);
  }

  console.log(`[db] Migration complete: ${(data.projects || []).length} project(s)`);
}
