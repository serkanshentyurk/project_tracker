# Lab Tracker

A self-hosted project management app built for research labs. Track animals, experiments, milestones, protocols, and decisions — all from one place.

Each lab deploys their own instance. No shared infrastructure, no third-party accounts required.

![SvelteKit](https://img.shields.io/badge/SvelteKit-2-orange) ![SQLite](https://img.shields.io/badge/SQLite-Turso-blue) ![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **Multi-project** — switch between projects from the sidebar; each has its own data, aims, and settings
- **Animals** — register animals, assign to aims, track progression through custom stage trajectories
- **Transitions** — log key stage changes; auto-updates the animal's current stage
- **Milestones** — phase-grouped checklists with Gantt chart integration; add/edit/reorder/delete phases
- **Log** — decisions and issues in one place; filter by kind, status, and priority
- **Protocols** — step-by-step procedures (rendered from markdown) with equipment checklists
- **Calendar** — aggregates deadlines from milestones, log entries, and custom events
- **Settings** — everything is editable: project name, aims (with stage trajectories), hypothesis text, Gantt timeline
- **Dynamic Gantt** — generated from milestone phases; milestone diamonds come from checklist items
- **Rich text editing** — toolbar with bold, italic, headings, lists, code, and colour highlights; live preview
- **Password protection** — optional shared password via environment variable
- **SQLite** — local file for development, [Turso](https://turso.tech) cloud for production (free tier)

---

## Quick start (local development)

Requires [Node.js](https://nodejs.org/) 20 or later.

```bash
git clone https://github.com/serkanshentyurk/project_tracker.git
cd project_tracker
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). A local SQLite database (`data/tracker.db`) is created automatically with an example project. No Turso account needed for local development.

---

## Deploying 

### 1. Create a Turso database (free)

[Turso](https://turso.tech) hosts your SQLite database in the cloud. Free tier includes 9 GB storage and 500 databases.

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Sign up / log in
turso auth signup    # or: turso auth login

# Create a database
turso db create project-tracker

# Get the connection URL
turso db show project-tracker --url
# → libsql://project-tracker-yourname.turso.io

# Create an auth token
turso db tokens create project-tracker
# → eyJhbGci...
```

Save the URL and token — you'll need them in the next step.

### 2. Deploy to Render

1. Fork or clone this repo to your own GitHub account
2. Go to [render.com](https://render.com) → **New** → **Blueprint**
3. Connect your repo — Render reads `render.yaml` and creates the service
4. In the Render dashboard, go to **Environment** and set:
   - `TURSO_URL` → the URL from step 1 (e.g. `libsql://project-tracker-yourname.turso.io`)
   - `TURSO_AUTH_TOKEN` → the token from step 1
   - `APP_PASSWORD` → a shared password for your lab (optional)
5. Redeploy — your tracker is live

Free tier on Render spins down after inactivity (~30s cold start). Your data is safe in Turso regardless. Starter plan ($7/mo) keeps it warm.

### Alternative: any server with Node.js

```bash
npm install
npm run build
TURSO_URL=libsql://... TURSO_AUTH_TOKEN=... APP_PASSWORD=secret PORT=3000 node build
```

Without Turso env vars, it falls back to a local SQLite file at `data/tracker.db`.

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `TURSO_URL` | For production | — | Turso database URL |
| `TURSO_AUTH_TOKEN` | For production | — | Turso auth token |
| `APP_PASSWORD` | No | — | Shared password. If not set, no login required. |
| `PORT` | No | 3000 | Server port |
| `DATA_DIR` | No | `./data` | Local SQLite file directory (dev only) |

---

## Password protection

```bash
# Local testing
APP_PASSWORD=labpass npm run dev

# Production — set in Render dashboard or as env var
```

No password set = no login screen. Sessions last 30 days. Logout button is in the sidebar.

---

## Usage guide

### Projects

The sidebar dropdown lets you switch between projects or create new ones. Each project has its own aims, animals, milestones, protocols, log, and settings — completely isolated.

### Aims & trajectories

**Settings** → **Aims**: define your project's aims. Each aim has a label, colour, description, tools, and a **stage trajectory** (the ordered list of stages an animal progresses through). Stages appear as the trajectory bar on the Animals page.

### Animals

Register animals and assign to an aim. The trajectory column shows progression. Stage changes are best logged via **Transitions**, which auto-updates the animal's current stage.

### Milestones & Gantt

Each phase has a name, colour, optional Gantt month range, optional sub-rows, and a checklist. Click items to cycle status. Items marked as **milestone** with a **Gantt month** appear as diamonds on the Overview Gantt chart.

### Log (decisions & issues)

Unified log with a `kind` field (decision or issue). Click status badges to cycle. Filters for kind, status, and priority.

### Protocols

Two sections per protocol: **steps** (rich text) and **checklist** (status-cycling items). Optionally linked to an aim.

### Calendar

Aggregates deadlines from milestones, log entries, and custom events. Right panel shows upcoming items within 60 days.

### Rich text

The formatting toolbar (hypothesis, protocol steps, log descriptions) supports:
- **B** bold, *I* italic, `</>` code
- **H** heading, **h** sub-heading, **•** bullet list
- **A** colour highlights (yellow, green, blue, red, purple)
- **Preview** toggle, **Ctrl+B** / **Ctrl+I** shortcuts

### Data management

**Settings** → **Data Management**: export/import JSON backups, reset to example data, or delete a project.

---

## Tech stack

- **Frontend:** SvelteKit 2, Svelte 5
- **Backend:** SvelteKit server routes (Node adapter)
- **Database:** SQLite via [@libsql/client](https://github.com/tursodatabase/libsql-client-ts) — local file for dev, Turso cloud for production
- **Deployment:** Render (or any Node.js host)
- **No external CDN dependencies**

---

## Development

```bash
npm run dev       # dev server with hot reload
npm run build     # production build
npm run preview   # preview production build locally
node build        # run production server
```

Delete `data/tracker.db` to re-seed from scratch.

### Project structure

```
src/
  lib/
    config.js              # seed data for new projects
    stores.js              # reactive stores (project-scoped)
    utils.js               # markdown renderer, helpers
    server/db.js           # database layer (libsql)
    components/
      Nav.svelte           # sidebar with project selector
      Toast.svelte         # notifications
      MarkdownEditor.svelte # rich text toolbar
  routes/
    +layout.svelte         # root layout (nav + auth gate)
    +page.svelte           # Overview (stats, hypothesis, Gantt)
    animals/               # animal registry
    transitions/           # stage change log
    milestones/            # phase checklists + Gantt data
    log/                   # decisions & issues
    protocols/             # procedures + checklists
    calendar/              # deadline aggregator
    settings/              # project config, aims, data mgmt
    login/                 # password gate
    api/data/              # data read/write endpoint
    api/auth/              # session endpoint
data/
  tracker.db               # local SQLite (gitignored)
```

---

## License

MIT
