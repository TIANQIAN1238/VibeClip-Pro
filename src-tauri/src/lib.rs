use mouse_position::mouse_position::Mouse;
use tauri::Manager;
use window_vibrancy::{apply_mica};

#[tauri::command]
fn get_mouse_position() -> Vec<i32> {
    let position = Mouse::get_mouse_position();
    match position {
        Mouse::Position { x, y } => vec![x, y],
        Mouse::Error => {
            println!("Error getting mouse position");
            vec![]
        },
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
