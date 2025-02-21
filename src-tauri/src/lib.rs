mod tray;

use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use mouse_position::mouse_position::Mouse;
use tauri::{AppHandle, Manager};
use tauri_plugin_autostart::MacosLauncher;
use window_vibrancy::{apply_acrylic, apply_mica};

#[tauri::command]
fn get_mouse_position() -> Vec<i32> {
    let position = Mouse::get_mouse_position();
    match position {
        Mouse::Position { x, y } => vec![x, y],
        Mouse::Error => {
            println!("Error getting mouse position");
            vec![]
        }
    }
}

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
        .invoke_handler(tauri::generate_handler![
            get_mouse_position,
            input_text,
            simulate_paste
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
