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
| `npm run tauri:dev` | Desktop tray app (development) |
| `npm run tauri:build` | Windows NSIS installer |

## Project layout

```text
personal-image-uploader/
├── backend/          # Node.js API, pipeline, SQLite
├── frontend/         # Angular UI
├── go_monitor/       # Go source for piu-monitor
├── docs/             # Technical spec and plan
├── scripts/          # Build helpers (Go, desktop, Tauri)
├── src-tauri/        # Tauri desktop app (tray, sidecar, NSIS hooks)
└── storage/          # Runtime transaction data (gitignored)
```

## Configuration

Inputs, outputs, and Discord credentials are stored in the local SQLite database (`backend/database.db`, created on first run). **Do not commit this file** — it may contain bot tokens and webhook URLs.

Configure everything through the web UI after starting the app.

## Desktop app (Tauri + system tray)

PIU can run as a **tray-only desktop app** on Windows. It starts the Node backend as a sidecar and exposes a menu:

- **Open in browser** — opens http://127.0.0.1:3737 (UI + API)
- **Quit** — stops the backend and exits

Left-click the tray icon also opens the browser.

Packaged user data (database, storage, logs) lives under:

`%APPDATA%\com.mmartinewski.piu\`

The install directory is typically:

`%LOCALAPPDATA%\PIU\`

### Build prerequisites (Windows)

| Tool | Purpose | Install |
|------|---------|---------|
| **Node.js 20+** | Backend, frontend, sidecar packaging | [nodejs.org](https://nodejs.org/) |
| **Go 1.22+** | File monitor (`piu-monitor.exe`) | [go.dev](https://go.dev/dl/) |
| **Rust (stable)** | Tauri desktop shell | [rustup.rs](https://rustup.rs/) |
| **VS 2022 Build Tools** | Rust linker (`link.exe`) on Windows | [Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) — workload **Desktop development with C++** |

After installing Rust, open a **new** terminal or ensure `cargo` is on PATH:

```powershell
# Default rustup location on Windows
$env:Path = "$env:USERPROFILE\.cargo\bin;" + $env:Path
cargo --version
```

The npm scripts `tauri:dev` and `tauri:build` prepend `%USERPROFILE%\.cargo\bin` to PATH automatically (see `scripts/run-tauri.cjs`), so a full terminal restart is not strictly required when using those commands.

Verify the C++ toolchain:

```powershell
rustc --print host-tuple   # e.g. x86_64-pc-windows-msvc
```

### Development (tray app)

```powershell
npm install
npm run tauri:dev
```

This builds the backend, Go monitor, and Angular assets, then launches the **tray app**. Use the tray menu **Open in browser** (or left-click the icon) to open http://127.0.0.1:3737.

### Release installer (NSIS)

From the repository root:

```powershell
npm install
npm run tauri:build
```

What this does:

1. `build:desktop` — Go monitor, backend TypeScript, Angular, Node sidecar (`esbuild` + `@yao-pkg/pkg`), and Tauri assets
2. `cargo build --release` — `piu-desktop.exe`
3. NSIS — Windows installer (~30 MB)

**Output:**

```text
src-tauri/target/release/bundle/nsis/PIU_1.0.0_x64-setup.exe
```

Copy the installer elsewhere if needed (the `release/` folder is gitignored):

```powershell
New-Item -ItemType Directory -Force release | Out-Null
Copy-Item src-tauri\target\release\bundle\nsis\PIU_*_x64-setup.exe release\
```

**Important:** End users must run the app from the **Start Menu** shortcut or the installed `piu-desktop.exe` under `%LOCALAPPDATA%\PIU\`. Do **not** run `src-tauri\target\release\piu-desktop.exe` directly — that binary has no bundled sidecar or assets.

First build can take several minutes (Rust + sidecar rebuild of `better-sqlite3` for Node 20).

### GitHub Releases

Releases are published automatically when a version tag is pushed. GitHub Actions builds the Windows NSIS installer on `windows-latest` and attaches it to the release.

**Version source of truth:** root `package.json` → synced to `backend/`, `frontend/`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` via `npm run version:sync`.

#### Publish a new release

1. Update `CHANGELOG.md` with the new version.
2. Bump the version (example `1.1.0`):

   ```powershell
   npm run version:sync 1.1.0
   ```

3. Commit and tag:

   ```powershell
   git add CHANGELOG.md package.json backend/package.json frontend/package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
   git commit -m "Release v1.1.0"
   git tag v1.1.0
   git push origin main
   git push origin v1.1.0
   ```

4. Open **GitHub → Releases** — the workflow uploads `PIU_<version>_x64-setup.exe` automatically.

Tags must match `v*.*.*` (e.g. `v1.0.0`, `v1.1.0-beta.1`). Pre-release tags containing `-` are marked as pre-releases on GitHub.

#### Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `.github/workflows/ci.yml` | push/PR to `main` | Build backend + frontend |
| `.github/workflows/release.yml` | push tag `v*.*.*` | Build Windows installer + GitHub Release |

#### First release (v1.0.0)

If v1.0.0 was never tagged:

```powershell
git tag v1.0.0
git push origin v1.0.0
```

### Uninstall

Use **Settings → Apps → PIU → Uninstall**. Optionally check **remove all user data** to delete `%APPDATA%\com.mmartinewski.piu\` and `%LOCALAPPDATA%\PIU\`.

If uninstall fails because a process is still running:

```powershell
taskkill /F /IM piu-desktop.exe /T
taskkill /F /IM piu-backend.exe /T
taskkill /F /IM piu-monitor.exe /T
```

### Troubleshooting (installed app)

| Symptom | What to check |
|--------|----------------|
| `cargo not found` during build | Add `%USERPROFILE%\.cargo\bin` to PATH or use `npm run tauri:build` (handles PATH) |
| `link.exe not found` | Install VS 2022 Build Tools with C++ workload |
| No tray icon / app exits immediately | `%APPDATA%\com.mmartinewski.piu\desktop-startup.log` |
| Port 3737 in use | Close other PIU instances or `npm run dev`; free the port with `Get-NetTCPConnection -LocalPort 3737` |
| Tray works but browser does not open | Open http://127.0.0.1:3737 manually; check `logs\piu.log` in AppData |

### Desktop scripts

| Script | Description |
|--------|-------------|
| `npm run tauri:dev` | Tray app in development mode |
| `npm run tauri:build` | Full NSIS installer |
| `npm run build:desktop` | Sidecar + assets only (called by `tauri:build`) |
| `npm run tauri:before-dev` | Prepare assets before `tauri dev` |

## Documentation

- [Technical specification](docs/v1.md)
- [Execution plan](docs/v1.plan.md)
- [Changelog](CHANGELOG.md)

## License

Private project — all rights reserved.
