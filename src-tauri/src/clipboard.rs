use anyhow::{Context, Result};
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use serde::{Deserialize, Serialize};

use crate::db::{ClipKind, ClipPayload};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardDraft {
    pub kind: ClipKind,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub image_base64: Option<String>,
    #[serde(default)]
    pub file_path: Option<String>,
    #[serde(default)]
    pub preview: Option<String>,
    #[serde(default)]
    pub extra: Option<String>,
    #[serde(default)]
    pub is_pinned: bool,
    #[serde(default)]
    pub is_favorite: bool,
}

impl ClipboardDraft {
    pub fn into_payload(self) -> Result<ClipPayload> {
        match self.kind {
            ClipKind::Text => {
                let content = self
                    .text
                    .context("Text clipboard payload is missing text field")?;
                Ok(ClipPayload {
                    kind: ClipKind::Text,
                    content,
                    preview: self.preview.or_else(|| Some("文本".to_string())),
                    extra: self.extra,
                    is_pinned: self.is_pinned,
                    is_favorite: self.is_favorite,
                })
            }
            ClipKind::Image => {
                let image_base64 = self
                    .image_base64
                    .context("Image payload requires base64 data")?;
                validate_base64(&image_base64)?;
                Ok(ClipPayload {
                    kind: ClipKind::Image,
                    content: image_base64.clone(),
                    preview: self.preview.or(Some("Image".into())),
                    extra: self.extra,
                    is_pinned: self.is_pinned,
                    is_favorite: self.is_favorite,
                })
            }
            ClipKind::File => {
                let path = self
                    .file_path
                    .context("File clipboard payload is missing file_path")?;
                Ok(ClipPayload {
                    kind: ClipKind::File,
                    content: path.clone(),
                    preview: self.preview.or_else(|| Some(path)),
                    extra: self.extra,
                    is_pinned: self.is_pinned,
                    is_favorite: self.is_favorite,
                })
            }
        }
    }
}

fn validate_base64(data: &str) -> Result<()> {
    BASE64_STANDARD
        .decode(data.trim())
        .context("Invalid base64 data provided for image clipboard entry")?;
    Ok(())
}
