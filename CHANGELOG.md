# Changelog

All notable changes to PIU are documented here. Version numbers follow [Semantic Versioning](https://semver.org/).

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

[1.0.0]: https://github.com/mmartinewski/personal-image-uploader/releases/tag/v1.0.0
