//! Template management for message templates

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Server-side message template
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerTemplate {
    pub id: String,
    pub content: String,
    pub priority: String,
}

/// Client-side feedback template
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientTemplate {
    pub id: String,
    pub content: String,
    pub feedback_type: String,
}

/// Template configuration containing both server and client templates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateConfig {
    pub server_templates: Vec<ServerTemplate>,
    pub client_templates: Vec<ClientTemplate>,
}

impl TemplateConfig {
    /// Create default template configuration
    pub fn default() -> Self {
        Self {
            server_templates: vec![
                ServerTemplate {
                    id: uuid::Uuid::new_v4().to_string(),
                    content: "巻いてください".to_string(),
                    priority: "high".to_string(),
                },
                ServerTemplate {
                    id: uuid::Uuid::new_v4().to_string(),
                    content: "押してます".to_string(),
                    priority: "normal".to_string(),
                },
                ServerTemplate {
                    id: uuid::Uuid::new_v4().to_string(),
                    content: "お水下さい".to_string(),
                    priority: "normal".to_string(),
                },
            ],
            client_templates: vec![
                ClientTemplate {
                    id: uuid::Uuid::new_v4().to_string(),
                    content: "了解しました".to_string(),
                    feedback_type: "ack".to_string(),
                },
                ClientTemplate {
                    id: uuid::Uuid::new_v4().to_string(),
                    content: "質問があります".to_string(),
                    feedback_type: "question".to_string(),
                },
                ClientTemplate {
                    id: uuid::Uuid::new_v4().to_string(),
                    content: "問題が発生しています".to_string(),
                    feedback_type: "issue".to_string(),
                },
                ClientTemplate {
                    id: uuid::Uuid::new_v4().to_string(),
                    content: "情報を共有します".to_string(),
                    feedback_type: "info".to_string(),
                },
            ],
        }
    }
}

/// Get the path to the templates configuration file
fn get_templates_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    // Create directory if it doesn't exist
    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    Ok(app_data_dir.join("templates.json"))
}

/// Load templates from file, or return defaults if file doesn't exist
pub fn load_templates(app_handle: &AppHandle) -> Result<TemplateConfig, String> {
    let path = get_templates_path(app_handle)?;

    if path.exists() {
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read templates file: {}", e))?;

        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse templates file: {}", e))
    } else {
        // Return default templates if file doesn't exist
        Ok(TemplateConfig::default())
    }
}

/// Save templates to file
pub fn save_templates(app_handle: &AppHandle, config: &TemplateConfig) -> Result<(), String> {
    let path = get_templates_path(app_handle)?;

    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize templates: {}", e))?;

    fs::write(&path, content).map_err(|e| format!("Failed to write templates file: {}", e))?;

    Ok(())
}
