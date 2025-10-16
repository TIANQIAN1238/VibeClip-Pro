use std::{path::Path, time::Duration};

use anyhow::Result;
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use image::codecs::png::PngEncoder;
use image::ColorType;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tracing::error;

use crate::clipboard::ClipboardDraft;
use crate::db::{ClipItem, ClipKind, DbState};
use crate::state::AppStatus;

const POLL_INTERVAL: Duration = Duration::from_millis(320);

pub fn spawn_clipboard_watcher<R: Runtime + 'static>(app: &AppHandle<R>) {
    let app_handle = app.clone();
    let db_state = app.state::<DbState>().clone();

    tauri::async_runtime::spawn(async move {
        let mut last_hash: Option<String> = None;

        loop {
            let status = app_handle.state::<AppStatus>();
            let listening = status.listening();
            drop(status);

            if !listening {
                tauri::async_runtime::sleep(POLL_INTERVAL).await;
                continue;
            }

            let result = tauri::async_runtime::spawn_blocking({
                let app_handle = app_handle.clone();
                let db_state = db_state.clone();
                let previous_hash = last_hash.clone();
                move || -> Result<Option<(ClipItem, String)>> {
                    if let Some(draft) = capture_clipboard(&app_handle)? {
                        let payload = draft.into_payload()?;
                        let hash = payload
                            .content_hash
                            .clone()
                            .unwrap_or_else(|| crate::hash::compute_content_hash(payload.kind, &payload.content));
                        if previous_hash.as_ref() == Some(&hash) {
                            return Ok(None);
                        }
                        let clip = db_state.upsert(payload)?;
                        Ok(Some((clip, hash)))
                    } else {
                        Ok(None)
                    }
                }
            })
            .await;

            match result {
                Ok(Ok(Some((clip, hash)))) => {
                    let _ = app_handle.emit_all("clipboard://captured", &clip);
                    last_hash = Some(hash);
                }
                Ok(Ok(None)) => {}
                Ok(Err(err)) => {
                    error!("clipboard watcher error: {err:?}");
                }
                Err(join_err) => {
                    error!("clipboard watcher join error: {join_err:?}");
                }
            }

            tauri::async_runtime::sleep(POLL_INTERVAL).await;
        }
    });
}

fn capture_clipboard<R: Runtime>(app: &AppHandle<R>) -> Result<Option<ClipboardDraft>> {
    let clipboard = app.clipboard();

    if let Ok(image) = clipboard.read_image() {
        if let Ok(draft) = build_image_payload(&image) {
            return Ok(Some(draft));
        }
    }

    if let Ok(text) = clipboard.read_text() {
        let sanitized = text.replace('\0', "");
        if sanitized.trim().is_empty() {
            return Ok(None);
        }

        if let Some((content, preview, extra)) = try_build_file_payload(&sanitized) {
            return Ok(Some(ClipboardDraft {
                kind: ClipKind::File,
                text: None,
                image_base64: None,
                file_path: Some(content),
                preview: Some(preview),
                extra,
                is_pinned: false,
                is_favorite: false,
            }));
        }

        let preview = sanitized.chars().take(120).collect::<String>();
        return Ok(Some(ClipboardDraft {
            kind: ClipKind::Text,
            text: Some(sanitized),
            image_base64: None,
            file_path: None,
            preview: Some(preview),
            extra: None,
            is_pinned: false,
            is_favorite: false,
        }));
    }

    Ok(None)
}

fn build_image_payload(image: &tauri::image::Image<'_>) -> Result<ClipboardDraft> {
    let mut buffer = Vec::new();
    {
        let mut encoder = PngEncoder::new(&mut buffer);
        encoder.encode(image.rgba(), image.width(), image.height(), ColorType::Rgba8)?;
    }
    let base64 = BASE64_STANDARD.encode(buffer);
    let preview = format!("{} × {} 图像", image.width(), image.height());
    Ok(ClipboardDraft {
        kind: ClipKind::Image,
        text: None,
        image_base64: Some(base64),
        file_path: None,
        preview: Some(preview),
        extra: None,
        is_pinned: false,
        is_favorite: false,
    })
}

fn try_build_file_payload(text: &str) -> Option<(String, String, Option<String>)> {
    let segments = text
        .split(|c| c == '\n' || c == '\r')
        .map(|part| part.trim())
        .filter(|part| !part.is_empty())
        .map(|part| part.trim_matches('"').to_string())
        .collect::<Vec<_>>();

    if segments.is_empty() {
        return None;
    }

    let looks_like_path = segments.iter().all(is_path_like);
    if !looks_like_path {
        return None;
    }

    let preview = if segments.len() == 1 {
        Path::new(&segments[0])
            .file_name()
            .and_then(|name| name.to_str())
            .map(|name| name.to_string())
            .unwrap_or_else(|| segments[0].clone())
    } else {
        format!("{} 个项目", segments.len())
    };
    let extra = segments.get(0).cloned();
    Some((segments.join("\n"), preview, extra))
}

fn is_path_like(value: &str) -> bool {
    if value.is_empty() {
        return false;
    }
    let path = Path::new(value);
    if path.exists() {
        return true;
    }
    value.contains('/') || value.contains('\\') || value.contains(':') || value.starts_with('~')
}
