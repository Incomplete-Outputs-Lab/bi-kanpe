//! Server-mode Tauri commands

use crate::config::ConnectedClientInfo;
use crate::state::{AppMode, AppState};
use kanpe_core::{Message, Priority};
use kanpe_core::types::VirtualMonitor;
use kanpe_server::events::ServerEvent;
use kanpe_server::KanpeServer;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::mpsc;

/// Start the Kanpe server
#[tauri::command]
pub async fn start_server(
    port: u16,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Check mode
    let mode = state.mode.read().await;
    if *mode == AppMode::Client {
        return Err("Cannot start server while in client mode".to_string());
    }
    drop(mode);

    // Set mode to Server
    *state.mode.write().await = AppMode::Server;

    // Create event channel
    let (event_tx, mut event_rx) = mpsc::unbounded_channel::<ServerEvent>();

    // Create and start server
    let mut server = KanpeServer::new(event_tx);
    server
        .start(port)
        .await
        .map_err(|e| format!("Failed to start server: {}", e))?;

    // Get initial monitors
    let monitors = server.get_monitors().await;

    // Store server in state
    *state.server.write().await = Some(server);

    // Emit server_started event with monitors
    app_handle
        .emit("server_started", serde_json::json!({ "port": port, "monitors": monitors }))
        .map_err(|e| format!("Failed to emit event: {}", e))?;

    // Spawn task to handle server events
    tokio::spawn(async move {
        while let Some(event) = event_rx.recv().await {
            match event {
                ServerEvent::ClientConnected {
                    client_id,
                    name,
                    monitor_ids,
                } => {
                    let _ = app_handle.emit(
                        "client_connected",
                        serde_json::json!({
                            "client_id": client_id,
                            "name": name,
                            "monitor_ids": monitor_ids,
                        }),
                    );
                }
                ServerEvent::ClientDisconnected { client_id } => {
                    let _ = app_handle.emit(
                        "client_disconnected",
                        serde_json::json!({
                            "client_id": client_id,
                        }),
                    );
                }
                ServerEvent::FeedbackReceived { message } => {
                    let _ = app_handle.emit("feedback_received", message);
                }
                ServerEvent::MonitorAdded { monitor } => {
                    let _ = app_handle.emit("monitor_added", monitor);
                }
                ServerEvent::MonitorRemoved { monitor_id } => {
                    let _ = app_handle.emit(
                        "monitor_removed",
                        serde_json::json!({ "monitor_id": monitor_id }),
                    );
                }
                ServerEvent::MonitorUpdated { monitor } => {
                    let _ = app_handle.emit("monitor_updated", monitor);
                }
            }
        }
    });

    Ok(())
}

/// Stop the Kanpe server
#[tauri::command]
pub async fn stop_server(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut server = state.server.write().await;
    if let Some(s) = server.take() {
        let mut s = s;
        s.stop()
            .await
            .map_err(|e| format!("Failed to stop server: {}", e))?;
    }

    // Reset mode
    *state.mode.write().await = AppMode::NotSelected;

    // Emit server_stopped event
    app_handle
        .emit("server_stopped", ())
        .map_err(|e| format!("Failed to emit event: {}", e))?;

    Ok(())
}

/// Send a Kanpe message to clients
#[tauri::command]
pub async fn send_kanpe_message(
    target_monitor_ids: Vec<String>,
    content: String,
    priority: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let server = state.server.read().await;
    if let Some(server) = server.as_ref() {
        // Parse priority
        let priority = match priority.to_lowercase().as_str() {
            "high" => Priority::High,
            "urgent" => Priority::Urgent,
            _ => Priority::Normal,
        };

        // Create and send message
        let message = Message::kanpe_message(content, target_monitor_ids, priority);
        server
            .broadcast_kanpe_message(message.clone())
            .await
            .map_err(|e| format!("Failed to send message: {}", e))?;

        // Emit event for sent message
        app_handle
            .emit("kanpe_message_sent", &message)
            .map_err(|e| format!("Failed to emit event: {}", e))?;

        Ok(())
    } else {
        Err("Server not running".to_string())
    }
}

/// Get list of connected clients
#[tauri::command]
pub async fn get_connected_clients(
    state: State<'_, AppState>,
) -> Result<Vec<ConnectedClientInfo>, String> {
    let server = state.server.read().await;
    if let Some(server) = server.as_ref() {
        let clients = server.get_connected_clients().await;
        Ok(clients
            .into_iter()
            .map(|c| ConnectedClientInfo {
                client_id: c.client_id,
                name: c.client_name,
                monitor_ids: c.display_monitor_ids,
            })
            .collect())
    } else {
        Err("Server not running".to_string())
    }
}

/// Add a new virtual monitor
#[tauri::command]
pub async fn add_virtual_monitor(
    name: String,
    description: Option<String>,
    color: Option<String>,
    state: State<'_, AppState>,
) -> Result<VirtualMonitor, String> {
    let server = state.server.read().await;
    if let Some(server) = server.as_ref() {
        server
            .add_monitor(name, description, color)
            .await
            .map_err(|e| format!("Failed to add monitor: {}", e))
    } else {
        Err("Server not running".to_string())
    }
}

/// Remove a virtual monitor
#[tauri::command]
pub async fn remove_virtual_monitor(
    monitor_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let server = state.server.read().await;
    if let Some(server) = server.as_ref() {
        server
            .remove_monitor(monitor_id)
            .await
            .map_err(|e| format!("Failed to remove monitor: {}", e))
    } else {
        Err("Server not running".to_string())
    }
}

/// Update a virtual monitor
#[tauri::command]
pub async fn update_virtual_monitor(
    monitor: VirtualMonitor,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let server = state.server.read().await;
    if let Some(server) = server.as_ref() {
        server
            .update_monitor(monitor)
            .await
            .map_err(|e| format!("Failed to update monitor: {}", e))
    } else {
        Err("Server not running".to_string())
    }
}

/// Get all virtual monitors
#[tauri::command]
pub async fn get_virtual_monitors(state: State<'_, AppState>) -> Result<Vec<VirtualMonitor>, String> {
    let server = state.server.read().await;
    if let Some(server) = server.as_ref() {
        Ok(server.get_monitors().await)
    } else {
        Err("Server not running".to_string())
    }
}

/// Send a flash command to clients
#[tauri::command]
pub async fn send_flash_command(
    target_monitor_ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let server = state.server.read().await;
    if let Some(server) = server.as_ref() {
        let message = Message::flash_command(target_monitor_ids);
        server
            .broadcast_flash_command(message)
            .await
            .map_err(|e| format!("Failed to send flash command: {}", e))?;
        Ok(())
    } else {
        Err("Server not running".to_string())
    }
}

/// Send a clear command to clients
#[tauri::command]
pub async fn send_clear_command(
    target_monitor_ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let server = state.server.read().await;
    if let Some(server) = server.as_ref() {
        let message = Message::clear_command(target_monitor_ids);
        server
            .broadcast_clear_command(message)
            .await
            .map_err(|e| format!("Failed to send clear command: {}", e))?;
        Ok(())
    } else {
        Err("Server not running".to_string())
    }
}
