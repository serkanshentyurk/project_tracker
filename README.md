# Project Tracker

A web app for managing mouse-training pipelines and behavioural data for
head-fixed auditory two-alternative forced-choice (2AFC) psychophysics
experiments in mice. Made for my own lab, and primarily built with AI
coding assistants; shared as a working tool, not a code sample.

It does two things:

1. **Tracks the project** — animals, training stages, milestones,
   protocols, a log, and a calendar, all per research project.
2. **Ingests and visualises behaviour** — scans raw Bonsai CSV output,
   runs it through the `behav_utils` analysis package, and stores
   per-session metrics (accuracy, psychometric fits, update matrices,
   reaction times, history weights, etc.) for browsing and plotting.

![License](https://img.shields.io/badge/license-MIT-green)

---

## Stack

- **Frontend / server**: SvelteKit (Node adapter)
- **Database**: PostgreSQL (normalised, ~15 tables)
- **Analysis service**: FastAPI wrapping `behav_utils`, on port 8100
- **Analysis package**: `behav_utils` (raw Bonsai CSV processing)

The web app and the analysis service are two separate processes that
talk over HTTP. The web app reads/writes PostgreSQL; when you trigger a
scan, it calls the analysis service, which reads raw CSVs and returns
computed metrics.

```
  Browser ──▶ SvelteKit (5173) ──▶ PostgreSQL
                   │
                   └──HTTP scan──▶ Analysis service (8100) ──▶ behav_utils ──▶ raw CSVs
```

---

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ (16 also fine)
- Python 3.10+ (for the analysis service)

---

## Quick start

### 1. Database

```bash
createdb tracker
export DATABASE_URL="postgres://localhost:5432/tracker"
psql "$DATABASE_URL" < schema.sql
```

Add the `DATABASE_URL` line to your `~/.zshrc` (or `~/.bashrc`) so it
persists across terminals.

### 2. Web app

```bash
npm install
npm run dev
```

Open the URL it prints (default http://localhost:5173). On first run
with an empty database it creates an example project.

### 3. Analysis service (for scanning raw CSVs)

```bash
cd analysis-service
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn app:app --host 0.0.0.0 --port 8100 --reload
```

**Always launch uvicorn with `.venv/bin/python -m uvicorn ...`** — using
a bare `uvicorn` may pick up a different Python environment that lacks
the dependencies.

Check it's up:

```bash
curl http://localhost:8100/health
# {"ok":true,"behav_utils_available":true,"version":"..."}
```

You now have two long-running processes (web app on 5173, analysis
service on 8100). Keep both running; use a third terminal for
`psql` / `curl`.

---

## First-time project setup

1. **Settings** → set the project title, supervisor, committee, and the
   processed-data directory (the parent folder containing per-animal
   subfolders).
2. **Settings** → paste your `behav_utils` config YAML into the config
   field. The analysis service uses this to interpret raw CSVs; scanning
   will not work without it. (It is stored in `projects.config_yaml`.)
3. Define at least one **aim** with a trajectory of training stages.
4. Add your **animals** (Animals page).
5. **Sessions** → "Scan folder" ingests matching CSVs.

### Importing a backup

Settings → Import accepts a JSON backup. Note it imports the **currently
selected** project; import once per project if your backup has several.

---

## How scanning works

- The web app's `/api/scan` reads the project's `config_yaml` from the
  database and calls the analysis service.
- The analysis service walks the data directory, loads each
  `Trial_Summary*.csv` via `behav_utils`, applies masking (from the
  `masking_sessions` block in the config), computes summary statistics
  plus psychometric/update-matrix data, and returns them.
- The web app upserts the results into the `sessions` table.
- If no `config_yaml` is set, or the analysis service is unreachable, the
  scan falls back to reading pre-computed JSON files (legacy path) — which
  will find nothing in a raw-CSV directory. If a scan returns
  `"source":"json-files"`, the analysis service was not used; check the
  config and that the service is running.

Empty CSVs (aborted recordings) produce errors in the scan result and no
usable session — this is expected.

---

## Data model

Raw data layout on the network volume:

```
{root}/{animal_id}/SOUND_CAT_{animal_id}_{YYYY}_{M}_{DD}/Trial_Summary{timestamp}.csv
```

PostgreSQL tables (assembled by `src/lib/server/db.js` into the shape the
frontend expects): `projects`, `aims`, `trajectory_stages`, `animals`,
`sessions` (behavioural sessions), `transitions` (stage changes),
`milestone_phases`, `milestone_items`, `log_entries`, `protocols`,
`protocol_items`, `events`, `scan_roots`, `meta`, `users`.

Note the naming: the `sessions` **table** holds behavioural sessions; in
the frontend, the store named `sessions` actually holds **transitions**
(stage changes), and behavioural sessions live in `session_data`. This is
a known confusing carry-over from an earlier schema.

Per-session metrics are stored as JSONB in `sessions.stats`, including
session-type flags `is_masking`, `is_opto`, `opto_frac`, the empirical
psychometric data (`psych_bin_*`, `psych_curve_*`), and the update matrix
(`um_0_0` … `um_7_7`).

---

## Project structure

```
src/
  routes/
    +page.svelte              Overview (Gantt, digest)
    animals/+page.svelte      Animal registry
    animals/[id]/+page.svelte Animal detail (curriculum, plots, history)
    sessions/+page.svelte     Behavioural sessions + trajectory chart
    transitions/+page.svelte  Stage transitions
    milestones/+page.svelte   Milestones
    protocols/+page.svelte    Protocols
    log/+page.svelte          Log
    calendar/+page.svelte     Calendar
    settings/+page.svelte     Project settings, import/export, scan config
    api/                      Per-entity REST endpoints (animals, sessions,
                              transitions, milestones, log, protocols,
                              events, aims, project, settings) + auth, pdf,
                              scan, data
  lib/
    server/db.js              PostgreSQL data-access layer
    stores.js                 Frontend stores (one save/remove fn per entity)
    components/               LineChart, PsychometricPlot, UpdateMatrix,
                              CurriculumStrip, Nav, Toast, MarkdownEditor,
                              PdfViewer
    flags.js                  Threshold "needs attention" rules
    utils.js                  Date / id helpers
schema.sql                    Canonical database schema
analysis-service/
  app.py                      FastAPI service (/health, /scan, /process-csv)
  behav_utils/                Vendored copy of the analysis package
  requirements.txt
```

---

## Configuration

| Variable         | Required | Purpose                                              |
| ---------------- | -------- | ---------------------------------------------------- |
| `DATABASE_URL` | yes      | PostgreSQL connection string                         |
| `APP_PASSWORD` | no       | If set, the app requires this password to log in     |
| `ANALYSIS_URL` | no       | Analysis service URL (default http://localhost:8100) |

The `behav_utils` config (column mappings, masking sessions, etc.) is not
an env var — it lives per-project in `projects.config_yaml`, editable in
Settings.

---

## Common issues

| Symptom                                  | Likely cause                                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `DATABASE_URL not set`                 | Env var missing in this terminal —`source ~/.zshrc` or prefix the command                         |
| `psql: command not found`              | PostgreSQL bin not on PATH (add`.../postgresql@NN/bin`)                                            |
| Scan returns`"source":"json-files"`    | `config_yaml` missing for the project, or analysis service down                                    |
| `ModuleNotFoundError` from the service | Launched with bare`uvicorn` instead of `.venv/bin/python -m uvicorn`                             |
| Scan returns 0 sessions, no errors       | Wrong data directory, or directory has no scannable folders                                          |
| `fetch failed` on scan                 | Long scan dropped the HTTP connection (see`src/routes/api/scan/+server.js` timeout/agent settings) |

---

## Notes

- The analysis service is required for live scanning. If you only need to
  view already-imported data, the web app runs without it.
- Re-scanning re-processes every CSV (no skip-if-known yet), so a full
  scan over a network volume can take several minutes.
- `behav_utils` is currently vendored into `analysis-service/`. Once it is
  published, it can be installed as a package instead.

---

## Development

```bash
npm run dev          # dev server with HMR
npm run build        # production build (Node adapter)
npm run preview      # preview the production build
npm run start        # run the built app (node build)
```

## License

MIT
