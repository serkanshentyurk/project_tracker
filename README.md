# Lab Tracker

A self-hosted project management app built for research labs. Track animals, experiments, milestones, protocols, and decisions — all from one place.

Each lab deploys their own instance. No shared infrastructure, no third-party accounts, no data leaves your server.

![SvelteKit](https://img.shields.io/badge/SvelteKit-2-orange) ![SQLite](https://img.shields.io/badge/SQLite-WAL-blue) ![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **Multi-project** — switch between projects from the sidebar; each has its own data, aims, and settings
- **Animals** — register animals, assign to aims, track progression through custom stage trajectories
- **Transitions** — log key stage changes; auto-updates the animal's current stage
- **Milestones** — phase-grouped checklists with Gantt chart integration; add/edit/reorder/delete phases
- **Log** — decisions and issues in one place; filter by kind, status, and priority
- **Protocols** — step-by-step procedures (rendered from markdown) with equipment checklists
- **Calendar** — aggregates deadlines from milestones, log entries, and custom events
- **Settings** — everything is editable: project name, aims (with stage trajectories), hypothesis text, Gantt timeline, data import/export
- **Dynamic Gantt** — generated from milestone phases, not hardcoded; milestone diamonds come from checklist items
- **Rich text editing** — toolbar with bold, italic, headings, lists, code, and colour highlights; live preview
- **Password protection** — optional shared password via environment variable
- **SQLite backend** — WAL mode for concurrent access; single file, easy to back up

---

## Quick start

Requires [Node.js](https://nodejs.org/) 20 or later.

```bash
git clone https://github.com/YOUR_USERNAME/lab-tracker.git
cd lab-tracker
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). A database (`data/tracker.db`) is created automatically with an example project.

---

## Deploying for your lab

### Option A: Render (recommended for teams)

1. Fork or clone this repo to your own GitHub account
2. Go to [render.com](https://render.com) → **New** → **Blueprint**
3. Connect your repo — Render reads `render.yaml` and creates the service automatically
4. In the Render dashboard, go to **Environment** and set `APP_PASSWORD` to a shared password for your lab
5. Done — share the URL with your team

The `render.yaml` configures a web service with a 1 GB persistent disk for the database. Free tier works but spins down after inactivity (~30s cold start). Starter plan ($7/mo) stays warm.

### Option B: Any server with Node.js

```bash
npm install
npm run build
APP_PASSWORD=your_secret PORT=3000 node build
```

The database lives at `data/tracker.db` (or wherever `DATA_DIR` points). Back it up periodically — it's a single file.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `APP_PASSWORD` | No | Shared password for login. If not set, no login required. |
| `PORT` | No | Server port (default: 3000 in production, 5173 in dev) |
| `DATA_DIR` | No | Directory for the database file (default: `./data`) |

---

## Password protection

Set the `APP_PASSWORD` environment variable to require a password:

```bash
# Local testing
APP_PASSWORD=labpass npm run dev

# Production
APP_PASSWORD=labpass node build
```

No password set = no login screen (convenient for local development). Sessions last 30 days. A logout button is in the sidebar.

---

## Usage guide

### Projects

Use the dropdown at the top of the sidebar to switch between projects or create new ones. Each project is completely isolated — its own aims, animals, milestones, protocols, log, and settings.

### Aims & trajectories

Go to **Settings** → **Aims** to define your project's aims. Each aim has a label, colour, description, tools, and a **stage trajectory** — the ordered list of stages an animal progresses through (e.g. Surgery → Recovery → Training → Expert → Done). These stages appear as the trajectory bar on the Animals page.

### Animals

Register animals and assign them to an aim. The trajectory column shows their progression through the aim's stages. Click a row to edit. Stage changes are best logged via the **Transitions** page, which auto-updates the animal's current stage.

### Milestones & Gantt

Each milestone **phase** has a name, colour, optional Gantt start/end months, optional Gantt sub-rows, and a checklist of items. Click items to cycle status (To do → In progress → Done → Blocked).

Items marked as **milestone** with a **Gantt month** appear as diamonds on the Overview Gantt chart. Completed milestones turn green.

To add a new phase, click **+ Add Phase** on the Milestones page. To reorder phases, use the ↑↓ buttons.

### Gantt chart

The Gantt on the Overview page is fully dynamic — it reads from milestone phases. Configure the timeline (start year, total months, current month) in **Settings** → **Gantt Timeline**.

### Log (decisions & issues)

A single unified log for both design decisions and issues/blockers. Each entry has a **kind** (decision or issue), which determines the available statuses and fields. Click the status badge to cycle it. Use filters to show only issues, only decisions, or by priority.

### Protocols

Each protocol has two sections: **steps** (rich text with markdown formatting) and a **checklist** (status-cycling items). You can add checklist items both during creation and after. Protocols can optionally be linked to an aim.

### Calendar

Aggregates deadlines from milestones (items with a calendar deadline), log entries (with deadlines), and custom events you create. The right panel shows upcoming items within 60 days.

### Rich text

Anywhere you see the formatting toolbar (hypothesis, protocol steps, log descriptions), you can use:

- **B** — bold (`**text**`)
- *I* — italic (`*text*`)
- `</>` — inline code
- **H** / **h** — heading / sub-heading
- **•** — bullet list
- **A** — colour highlight (yellow, green, blue, red, purple)
- **Preview** — toggle between editing and rendered view
- **Ctrl+B** / **Ctrl+I** — keyboard shortcuts

### Data management

Go to **Settings** → **Data Management** to:

- **Export** — download a JSON backup of all projects
- **Import** — restore from a backup file
- **Reset** — wipe the current project and re-seed with example data
- **Delete** — remove the current project (if more than one exists)

---

## Tech stack

- **Frontend:** SvelteKit 2, Svelte 5
- **Backend:** SvelteKit server routes (Node adapter)
- **Database:** SQLite via better-sqlite3 (WAL mode)
- **Deployment:** Render (or any Node.js host)
- **No external CDN dependencies** — works fully offline once loaded

---

## Development

```bash
npm run dev       # dev server with hot reload
npm run build     # production build
npm run preview   # preview production build locally
node build        # run production server
```

The database file (`data/tracker.db`) is gitignored. Delete it to re-seed from scratch.

### Project structure

```
src/
  lib/
    config.js           # seed data for new projects
    stores.js           # reactive stores (project-scoped)
    utils.js            # markdown renderer, helpers
    server/db.js        # SQLite read/write
    components/
      Nav.svelte        # sidebar with project selector
      Toast.svelte      # notification popups
      MarkdownEditor.svelte  # rich text toolbar
  routes/
    +layout.svelte      # root layout (nav + auth gate)
    +page.svelte        # Overview (stats, hypothesis, Gantt)
    animals/            # animal registry
    transitions/        # stage change log
    milestones/         # phase checklists + Gantt data
    log/                # decisions & issues
    protocols/          # procedures + equipment checklists
    calendar/           # deadline aggregator
    settings/           # project config, aims, data management
    login/              # password gate
    api/data/           # JSON read/write endpoint
    api/auth/           # session cookie endpoint
data/
  tracker.db            # SQLite database (gitignored, auto-created)
```

---

## License

MIT
