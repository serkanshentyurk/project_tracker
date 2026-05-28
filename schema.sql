-- =============================================================================
-- Lab Tracker — PostgreSQL Schema
-- =============================================================================
-- Replaces the old 2-table (meta, projects) design where each project
-- was a single JSON blob. Every entity now has its own table with proper
-- foreign keys, timestamps, and indexes.
--
-- Run: psql $DATABASE_URL < schema.sql
-- =============================================================================

-- ── Metadata ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT
);

-- ── Projects ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL DEFAULT 'New Project',
    project_full    TEXT DEFAULT '',
    supervisor      TEXT DEFAULT '',
    committee       JSONB DEFAULT '[]',           -- array of strings
    hypothesis      TEXT DEFAULT '',
    gantt_today_month   INT DEFAULT 1,
    gantt_total_months  INT DEFAULT 36,
    gantt_start_year    INT DEFAULT 2026,
    config_yaml     TEXT,                          -- behav_utils YAML config
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Scan Roots ───────────────────────────────────────────────────────────────
-- Multiple data directories per project (replaces single processed_data_dir)

CREATE TABLE IF NOT EXISTS scan_roots (
    id          SERIAL PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    path        TEXT NOT NULL,
    label       TEXT DEFAULT '',                    -- e.g. "Lab server", "Serkan local"
    auto_scan   BOOLEAN DEFAULT FALSE,
    scan_interval_min INT DEFAULT 30,
    last_scanned_at   TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scan_roots_project ON scan_roots(project_id);

-- ── Aims ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aims (
    id          TEXT NOT NULL,                      -- e.g. 'A1'
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    title       TEXT DEFAULT '',
    description TEXT DEFAULT '',
    color       TEXT DEFAULT '#3b82f6',
    tools       JSONB DEFAULT '[]',                -- array of strings
    sort_order  INT DEFAULT 0,
    PRIMARY KEY (project_id, id)
);

-- ── Trajectory Stages ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trajectory_stages (
    project_id  TEXT NOT NULL,
    aim_id      TEXT NOT NULL,
    id          TEXT NOT NULL,                      -- e.g. 'SURG'
    label       TEXT NOT NULL,
    short       TEXT DEFAULT '',
    type        TEXT DEFAULT 'behaviour',           -- surgery, husbandry, behaviour, opto, imaging, done
    sort_order  INT NOT NULL DEFAULT 0,
    PRIMARY KEY (project_id, aim_id, id),
    FOREIGN KEY (project_id, aim_id) REFERENCES aims(project_id, id) ON DELETE CASCADE
);

-- ── Animals ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS animals (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    track_id        TEXT NOT NULL,                  -- e.g. 'SS05'
    lab_id          TEXT DEFAULT '',
    cage            TEXT DEFAULT '',
    sex             TEXT DEFAULT '',
    aim_id          TEXT,                           -- references aims.id within same project
    strain          TEXT DEFAULT '',
    mutation1       TEXT DEFAULT '',
    dob             DATE,
    hp_date         DATE,
    wr_start        DATE,
    train_start     DATE,
    surgery_date    DATE,
    aav_date        DATE,
    window_grade    TEXT DEFAULT '',
    gcamp           TEXT DEFAULT '',
    opto_batch      TEXT DEFAULT '',
    current_stage   TEXT DEFAULT '',
    stage_dates     JSONB DEFAULT '{}',
    notes           TEXT DEFAULT '',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_animals_project ON animals(project_id);
CREATE INDEX IF NOT EXISTS idx_animals_track ON animals(project_id, track_id);

-- ── Sessions (behavioural data) ──────────────────────────────────────────────
-- Each row = one behavioural session with computed summary stats.
-- Trial-level data is NOT stored — only the session-level stats JSON.

CREATE TABLE IF NOT EXISTS sessions (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    animal_id       TEXT REFERENCES animals(id) ON DELETE SET NULL,
    animal_track_id TEXT NOT NULL,                  -- denormalised for convenience
    date            DATE NOT NULL,
    stage           TEXT DEFAULT '',
    distribution    TEXT DEFAULT '',
    folder          TEXT DEFAULT '',                -- relative path to source folder
    source          TEXT DEFAULT 'scan',            -- 'scan', 'upload', 'manual'
    stats           JSONB DEFAULT '{}',             -- computed session stats from behav_utils
    pdfs            JSONB DEFAULT '[]',             -- legacy: list of {name, type}
    raw_csv_path    TEXT DEFAULT '',                -- absolute path to original CSV
    notes           TEXT DEFAULT '',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_animal ON sessions(animal_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(project_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_dedup
    ON sessions(project_id, animal_track_id, date);

-- ── Transitions (stage changes) ──────────────────────────────────────────────
-- Previously confusingly called "sessions" in the codebase.

CREATE TABLE IF NOT EXISTS transitions (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    animal_id   TEXT REFERENCES animals(id) ON DELETE SET NULL,
    date        DATE NOT NULL,
    stage_from  TEXT DEFAULT '',
    stage_to    TEXT NOT NULL,
    notes       TEXT DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transitions_project ON transitions(project_id);
CREATE INDEX IF NOT EXISTS idx_transitions_animal ON transitions(animal_id);

-- ── Milestone Phases ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS milestone_phases (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    color       TEXT DEFAULT '#3b82f6',
    gantt_start INT,
    gantt_end   INT,
    gantt_rows  JSONB DEFAULT '[]',                -- [{label, s, e}, ...]
    sort_order  INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestone_phases(project_id);

-- ── Milestone Items ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS milestone_items (
    id              TEXT PRIMARY KEY,
    phase_id        TEXT NOT NULL REFERENCES milestone_phases(id) ON DELETE CASCADE,
    text            TEXT NOT NULL,
    status          TEXT DEFAULT 'todo',            -- todo, inprog, done, blocked
    is_milestone    BOOLEAN DEFAULT FALSE,
    deadline        DATE,
    deadline_month  INT,                            -- for Gantt placement
    sort_order      INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_milestone_items_phase ON milestone_items(phase_id);

-- ── Log Entries (decisions & issues) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS log_entries (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    date            DATE,
    kind            TEXT NOT NULL DEFAULT 'issue',  -- 'decision', 'issue'
    status          TEXT DEFAULT 'open',
    title           TEXT NOT NULL,
    body            TEXT DEFAULT '',
    risks           TEXT DEFAULT '',
    priority        TEXT,                           -- 'low', 'medium', 'high'
    deadline        DATE,
    resolved_date   DATE,
    resolution      TEXT DEFAULT '',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_log_project ON log_entries(project_id);

-- ── Protocols ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS protocols (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    aim_id      TEXT DEFAULT '',
    steps       TEXT DEFAULT '',                    -- markdown
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_protocols_project ON protocols(project_id);

-- ── Protocol Items (checklists) ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS protocol_items (
    id          TEXT PRIMARY KEY,
    protocol_id TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
    text        TEXT NOT NULL,
    status      TEXT DEFAULT 'todo',
    sort_order  INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_protocol_items_protocol ON protocol_items(protocol_id);

-- ── Calendar Events ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS events (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    date        DATE NOT NULL,
    type        TEXT DEFAULT 'custom',
    notes       TEXT DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id);

-- ── Users (stub for Phase 2 multi-user) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    email       TEXT UNIQUE NOT NULL,
    name        TEXT DEFAULT '',
    password_hash TEXT NOT NULL,
    role        TEXT DEFAULT 'editor',              -- 'admin', 'editor', 'viewer'
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
