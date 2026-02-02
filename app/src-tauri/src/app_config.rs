//! Application configuration management

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Application configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// Whether the user has seen the donation prompt
    pub has_seen_donation_prompt: bool,
    /// Timestamp of first launch (Unix timestamp in milliseconds)
    pub first_launch_timestamp: Option<i64>,
}

impl AppConfig {
    /// Create default application configuration
    pub fn default() -> Self {
        Self {
            has_seen_donation_prompt: false,
            first_launch_timestamp: Some(chrono::Utc::now().timestamp_millis()),
        }
    }
}

/// Get the path to the application configuration file
fn get_app_config_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    // Create directory if it doesn't exist
    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    Ok(app_data_dir.join("config.json"))
}

/// Load application configuration from file, or return defaults if file doesn't exist
pub fn load_app_config(app_handle: &AppHandle) -> Result<AppConfig, String> {
    let path = get_app_config_path(app_handle)?;

    if path.exists() {
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read config file: {}", e))?;

        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse config file: {}", e))
    } else {
        // Return default config if file doesn't exist
        Ok(AppConfig::default())
    }
}

/// Save application configuration to file
pub fn save_app_config(app_handle: &AppHandle, config: &AppConfig) -> Result<(), String> {
    let path = get_app_config_path(app_handle)?;

    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&path, content).map_err(|e| format!("Failed to write config file: {}", e))?;

    Ok(())
}
