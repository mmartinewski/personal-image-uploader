use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, RunEvent,
};
use tauri_plugin_log::{Target, TargetKind};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_shell::{process::CommandChild, process::CommandEvent, ShellExt};

const APP_URL: &str = "http://127.0.0.1:3737";

struct BackendState {
    child: Mutex<Option<CommandChild>>,
    shutting_down: Mutex<bool>,
    backend_ready: Mutex<bool>,
}

fn set_shutting_down(app: &AppHandle, value: bool) {
    if let Ok(mut guard) = app.state::<BackendState>().shutting_down.lock() {
        *guard = value;
    }
}

fn is_shutting_down(app: &AppHandle) -> bool {
    app.state::<BackendState>()
        .shutting_down
        .lock()
        .map(|guard| *guard)
        .unwrap_or(false)
}

fn set_backend_ready(app: &AppHandle, value: bool) {
    if let Ok(mut guard) = app.state::<BackendState>().backend_ready.lock() {
        *guard = value;
    }
}

fn is_backend_ready(app: &AppHandle) -> bool {
    app.state::<BackendState>()
        .backend_ready
        .lock()
        .map(|guard| *guard)
        .unwrap_or(false)
}

fn mark_backend_ready_if_started(app: &AppHandle, line: &str) {
    if line.contains("PIU backend started") || line.contains("API server listening") {
        set_backend_ready(app, true);
    }
}

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("repo root")
        .to_path_buf()
}

fn install_dir() -> Result<PathBuf, String> {
    std::env::current_exe()
        .map_err(|e| e.to_string())
        .and_then(|exe| {
            exe.parent()
                .map(|dir| dir.to_path_buf())
                .ok_or_else(|| "current executable has no parent directory".to_string())
        })
}

fn startup_log_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("desktop-startup.log"))
}

fn write_startup_log(app: &AppHandle, message: &str) {
    if let Ok(path) = startup_log_path(app) {
        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
            let _ = writeln!(file, "{message}");
        }
    }
}

#[cfg(windows)]
fn show_startup_error(message: &str) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let escaped = message.replace('\'', "''");
    let script = format!(
        "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('{escaped}','PIU')"
    );
    let _ = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", &script])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();
}

#[cfg(not(windows))]
fn show_startup_error(message: &str) {
    eprintln!("PIU startup error: {message}");
}

fn sidecar_assets_dir() -> Result<PathBuf, String> {
    let exe_dir = install_dir()?;
    let beside_exe = exe_dir.join("piu-backend-assets");
    if beside_exe.is_dir() {
        return Ok(beside_exe);
    }

    Err(format!(
        "piu-backend-assets not found beside {}",
        exe_dir.display()
    ))
}

fn spawn_backend(app: &AppHandle) -> Result<(), String> {
    let (mut rx, child) = if cfg!(debug_assertions) {
        let root = repo_root();
        let backend_entry = root.join("backend").join("dist").join("index.js");
        let frontend_dist = root
            .join("frontend")
            .join("dist")
            .join("frontend")
            .join("browser");

        app.shell()
            .command("node")
            .args([backend_entry.to_string_lossy().to_string()])
            .env("PIU_APP_ROOT", root.join("backend").to_string_lossy().to_string())
            .env(
                "PIU_FRONTEND_DIST",
                frontend_dist.to_string_lossy().to_string(),
            )
            .spawn()
            .map_err(|e| e.to_string())?
    } else {
        let assets = sidecar_assets_dir()?;
        let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
        std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;

        write_startup_log(
            app,
            &format!(
                "sidecar assets={} data={}",
                assets.display(),
                data_dir.display()
            ),
        );

        let sqlite_native = assets.join("better_sqlite3.node");
        let mut sidecar = app
            .shell()
            .sidecar("piu-backend")
            .map_err(|e| {
                format!(
                    "sidecar not found next to the installed app (do not run target/release/piu-desktop.exe directly): {e}"
                )
            })?;
        sidecar = sidecar
            .env("PIU_APP_ROOT", assets.to_string_lossy().to_string())
            .env("PIU_DATA_DIR", data_dir.to_string_lossy().to_string());
        if sqlite_native.exists() {
            sidecar = sidecar.env(
                "BETTER_SQLITE3_NATIVE",
                sqlite_native.to_string_lossy().to_string(),
            );
        }
        sidecar.spawn().map_err(|e| e.to_string())?
    };

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stderr(line) => {
                    let text = String::from_utf8_lossy(&line).trim().to_string();
                    log::warn!("backend stderr: {text}");
                    write_startup_log(&app_handle, &format!("backend stderr: {text}"));
                }
                CommandEvent::Stdout(line) => {
                    let text = String::from_utf8_lossy(&line).trim().to_string();
                    log::info!("backend stdout: {text}");
                    mark_backend_ready_if_started(&app_handle, &text);
                }
                CommandEvent::Terminated(payload) => {
                    write_startup_log(
                        &app_handle,
                        &format!("backend terminated: {payload:?}"),
                    );
                    if is_shutting_down(&app_handle) {
                        log::info!("backend stopped during app shutdown");
                        break;
                    }
                    if payload.code == Some(0) {
                        log::info!("backend sidecar exited cleanly (existing instance on port 3737)");
                        break;
                    }
                    if is_backend_ready(&app_handle) {
                        log::warn!("backend stopped after startup (no error dialog)");
                        break;
                    }
                    log::error!("backend terminated during startup: {payload:?}");
                    show_startup_error(
                        "PIU backend failed to start.\n\nIf port 3737 is in use, close `npm run dev` or other PIU instances, then try again.\n\nDetails: desktop-startup.log in AppData.",
                    );
                    let _ = app_handle.exit(1);
                    break;
                }
                _ => {}
            }
        }
    });

    app.state::<BackendState>()
        .child
        .lock()
        .map_err(|e| e.to_string())?
        .replace(child);

    Ok(())
}

fn stop_backend(app: &AppHandle) {
    set_shutting_down(app, true);

    request_backend_shutdown();
    std::thread::sleep(std::time::Duration::from_millis(1500));

    if let Ok(mut guard) = app.state::<BackendState>().child.lock() {
        if let Some(child) = guard.take() {
            let _ = child.kill();
        }
    }

    force_kill_pi_processes();
}

#[cfg(windows)]
fn request_backend_shutdown() {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let _ = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "try { Invoke-WebRequest -Uri http://127.0.0.1:3737/api/shutdown -Method POST -UseBasicParsing -TimeoutSec 2 | Out-Null } catch {}",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();
}

#[cfg(not(windows))]
fn request_backend_shutdown() {
    let _ = std::process::Command::new("curl")
        .args(["-s", "-X", "POST", "http://127.0.0.1:3737/api/shutdown"])
        .spawn();
}

#[cfg(windows)]
fn force_kill_pi_processes() {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    for exe in ["piu-backend.exe", "piu-monitor.exe"] {
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/IM", exe, "/T"])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
    }
}

#[cfg(not(windows))]
fn force_kill_pi_processes() {}

fn open_in_browser(app: &AppHandle) {
    if let Err(err) = app.opener().open_url(APP_URL, None::<&str>) {
        log::error!("failed to open browser: {err}");
        show_startup_error(&format!("Could not open browser:\n{err}"));
    }
}

fn build_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let open_item = MenuItem::with_id(app, "open_browser", "Open in browser", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open_item, &quit_item])?;

    let icon = app.default_window_icon().cloned().expect("tray icon");

    let _tray = TrayIconBuilder::with_id("main")
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Personal Image Uploader")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open_browser" => open_in_browser(app),
            "quit" => {
                stop_backend(app);
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                open_in_browser(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .targets([
                    Target::new(TargetKind::LogDir {
                        file_name: Some("piu-desktop".into()),
                    }),
                    Target::new(TargetKind::Stdout),
                ])
                .level(log::LevelFilter::Info)
                .build(),
        )
        .manage(BackendState {
            child: Mutex::new(None),
            shutting_down: Mutex::new(false),
            backend_ready: Mutex::new(false),
        })
        .setup(|app| {
            write_startup_log(app.handle(), "PIU desktop starting");

            build_tray(app)?;

            match spawn_backend(app.handle()) {
                Ok(()) => {
                    log::info!("backend sidecar spawned");
                    write_startup_log(app.handle(), "backend sidecar spawned");
                }
                Err(err) => {
                    log::error!("failed to spawn backend: {err}");
                    write_startup_log(app.handle(), &format!("failed to spawn backend: {err}"));
                    show_startup_error(&format!(
                        "PIU could not start the backend:\n{err}\n\nUse the Start Menu shortcut or the installed piu-desktop.exe, not target/release/piu-desktop.exe."
                    ));
                }
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error building PIU desktop")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                stop_backend(app);
            }
        });
}
