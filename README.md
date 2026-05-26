# Personal Image Uploader (PIU)

Watch local directories and upload new images to Discord (bot or webhook) using configurable routing rules and fallback channels.

## Features

- Recursive directory monitoring via a native Go file watcher
- Pattern-based routing with fan-out to multiple Discord destinations
- Fallback channels when no rule matches
- Transactional pipeline with retry, DLQ, and recovery on restart
- Angular dashboard with live SSE updates

## Prerequisites

- **Node.js** 20+
- **npm** 10+
- **Go** 1.22+ (required to build the file monitor on `npm install`)

## Quick start

```bash
git clone git@github.com:mmartinewski/personal-image-uploader.git
cd personal-image-uploader
npm install
npm run db:migrate
npm run dev
```

- **Backend API:** http://127.0.0.1:3737
- **Frontend UI:** http://localhost:4200

If the backend reports another instance is already running, stop other `npm run dev` terminals or delete `backend/.piu.pid`.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Backend + frontend (concurrently) |
| `npm run dev:backend` | Backend only |
| `npm run dev:frontend` | Angular dev server |
| `npm run db:migrate` | Apply SQLite migrations |
| `npm run build:go` | Compile Go file monitor |
| `npm start` | Run backend in production mode |

## Project layout

```text
personal-image-uploader/
├── backend/          # Node.js API, pipeline, SQLite
├── frontend/         # Angular UI
├── go_monitor/       # Go source for piu-monitor
├── docs/             # Technical spec and plan
├── scripts/          # Build helpers
└── storage/          # Runtime transaction data (gitignored)
```

## Configuration

Inputs, outputs, and Discord credentials are stored in the local SQLite database (`backend/database.db`, created on first run). **Do not commit this file** — it may contain bot tokens and webhook URLs.

Configure everything through the web UI after starting the app.

## Documentation

- [Technical specification](docs/v1.md)
- [Execution plan](docs/v1.plan.md)

## License

Private project — all rights reserved.
