//! Application-level commands

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppVersionInfo {
    pub version: String,
    pub git_commit: Option<String>,
    pub build_timestamp: Option<String>,
}

#[tauri::command]
pub fn get_app_version() -> AppVersionInfo {
    AppVersionInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        git_commit: option_env!("GIT_COMMIT_HASH").map(|s| s.to_string()),
        build_timestamp: option_env!("BUILD_TIMESTAMP").map(|s| s.to_string()),
    }
}
