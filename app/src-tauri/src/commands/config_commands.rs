//! Configuration-related commands

use crate::app_config::{load_app_config, save_app_config, AppConfig};
use tauri::AppHandle;

/// Check if this is the first launch (user hasn't seen donation prompt yet)
#[tauri::command]
pub async fn check_first_launch(app_handle: AppHandle) -> Result<bool, String> {
    let config = load_app_config(&app_handle)?;
    Ok(!config.has_seen_donation_prompt)
}

/// Mark that the user has seen the donation prompt
#[tauri::command]
pub async fn mark_donation_prompt_seen(app_handle: AppHandle) -> Result<(), String> {
    let mut config = load_app_config(&app_handle)?;
    config.has_seen_donation_prompt = true;
    save_app_config(&app_handle, &config)?;
    Ok(())
}

/// Get the full application configuration (for debugging/future use)
#[tauri::command]
pub async fn get_app_config(app_handle: AppHandle) -> Result<AppConfig, String> {
    load_app_config(&app_handle)
}
