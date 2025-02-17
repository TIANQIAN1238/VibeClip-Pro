mod tray;

use mouse_position::mouse_position::Mouse;
use tauri::{tray::TrayIconBuilder, AppHandle, Manager};
use tauri_plugin_autostart::MacosLauncher;
use window_vibrancy::apply_mica;

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
        .setup(|app| {
            let tray = TrayIconBuilder::new()
            .icon(app.default_window_icon().unwrap().clone())
            .build(app)?;
            Ok(())
        })
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
            let window = app.get_webview_window("context").unwrap();
            apply_mica(window, Some(true)).expect("unsupported");
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_mouse_position])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
