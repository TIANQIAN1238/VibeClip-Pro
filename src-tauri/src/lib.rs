mod tray;

use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_store::StoreExt;
use window_vibrancy::{apply_acrylic, apply_mica};

use serde_json::json;

#[tauri::command]
async fn input_text(text: &str) -> Result<(), String> {
    let mut enigo = Enigo::new(&Settings::default()).unwrap();
    enigo.text(text).unwrap();
    Ok(())
}

#[tauri::command]
async fn simulate_paste() -> Result<(), String> {
    let mut enigo = Enigo::new(&Settings::default()).unwrap();
    let _ = enigo.key(Key::Control, Direction::Press);
    let _ = enigo.key(Key::V, Direction::Click);
    let _ = enigo.key(Key::Control, Direction::Release);
    Ok(())
}

#[tauri::command]
async fn get_key_from_store<R: Runtime>(
    app: tauri::AppHandle<R>,
    _window: tauri::Window<R>,
    key: String,
    fallback: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let stores = app.store("store.bin");
    let store = match stores {
        Ok(store) => store,
        Err(_) => return Ok(fallback),
    };
    if store.has(key.clone()) {
        let value = store
            .get(key.clone())
            .expect("Failed to get value from store");
        Ok(value)
    } else {
        Ok(fallback)
    }
}

#[tauri::command]
async fn set_key_to_store<R: Runtime>(
    app: tauri::AppHandle<R>,
    _window: tauri::Window<R>,
    key: String,
    value: serde_json::Value,
) -> Result<(), String> {
    let stores = app.store("store.bin");
    let store = match stores {
        Ok(store) => store,
        Err(_) => return Err("Failed to get store".to_string()),
    };
    store.set(key.clone(), json!(value));
    store.save().expect("Failed to save store");
    Ok(())
}

fn show_window(app: &AppHandle) {
    let windows = app.webview_windows();

    windows
        .values()
        .next()
        .expect("Sorry, no window found")
        .set_focus()
        .expect("Can't Bring Window to Focus");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = show_window(app);
        }))
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let mainwindow = app.get_webview_window("main").unwrap();
            let panelwindow = app.get_webview_window("context").unwrap();
            apply_mica(mainwindow.clone(), Some(true))
                .or_else(|_| apply_acrylic(mainwindow, Some((18, 18, 18, 125))))
                .expect("unsupported");
            apply_mica(panelwindow.clone(), Some(true))
                .or_else(|_| apply_acrylic(panelwindow, Some((18, 18, 18, 125))))
                .expect("unsupported");

            let handle = app.handle();
            let _ = tray::create_tray(handle);
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_cors_fetch::init())
        .invoke_handler(tauri::generate_handler![
            input_text,
            simulate_paste,
            get_key_from_store,
            set_key_to_store
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
