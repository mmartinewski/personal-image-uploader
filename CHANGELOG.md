# Changelog

All notable changes to PIU are documented here. Version numbers follow [Semantic Versioning](https://semver.org/).

## [1.4.0] - 2026-06-27

### Added

- Multiple Discord webhook URLs per output (tag input in the UI; image sent to every URL)
- Routing rule option **Also send to the default fallback channel when this rule matches**
- Export/import preserves `webhook_urls` and `also_send_default_fallback` (legacy `webhook_url` still accepted on import)

### Changed

- Release workflow locates the NSIS installer explicitly and fails if the asset is missing

## [1.2.0] - 2026-05-31

### Added

- Export outputs to JSON (routing rules, fallback channels, default fallback, Discord credentials)
- Import outputs from JSON with **Add** (merge, skip duplicates) or **Replace all** modes
- `GET /api/outputs/export` and `POST /api/outputs/import` backend endpoints

### Fixed

- Export download blocked by browser user-gesture rules (client-side export)
- Import failing silently when an old backend was already listening on port 3737
- `npm run dev` now stops the previous process on port 3737 before starting the backend

## [1.1.0] - 2026-05-31

### Added

- Date/time picker (Flatpickr) for the input **Upload only files created from** field — calendar + hour selection in dark theme

## [1.0.0] - 2026-05-31

### Added

- Windows desktop app (Tauri 2) with system tray: Open in browser, Quit
- Node sidecar backend with embedded SQLite, Go file monitor, and bundled Angular UI
- Input `upload_after` cutoff — only upload files created from a configured date/time (defaults to now on new inputs)
- Graceful shutdown and uninstall hooks (backend, monitor, AppData cleanup)
- GitHub Actions release workflow for Windows NSIS installer

### Fixed

- Packaged `better-sqlite3` rebuilt for Node 20 sidecar
- Sidecar asset paths and `bindings` dependency in installer layout
- False error dialogs on Quit and uninstall

[1.4.0]: https://github.com/mmartinewski/personal-image-uploader/releases/tag/v1.4.0
[1.2.0]: https://github.com/mmartinewski/personal-image-uploader/releases/tag/v1.2.0
[1.1.0]: https://github.com/mmartinewski/personal-image-uploader/releases/tag/v1.1.0
[1.0.0]: https://github.com/mmartinewski/personal-image-uploader/releases/tag/v1.0.0
