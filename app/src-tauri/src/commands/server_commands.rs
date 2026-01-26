//! Server-mode Tauri commands

use crate::config::ConnectedClientInfo;
use crate::state::{AppMode, AppState};
use kanpe_core::{Message, Priority};
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

    // Store server in state
    *state.server.write().await = Some(server);

    // Emit server_started event
    app_handle
        .emit("server_started", serde_json::json!({ "port": port }))
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
    target_monitor_ids: Vec<u32>,
    content: String,
    priority: String,
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
            .broadcast_kanpe_message(message)
            .await
            .map_err(|e| format!("Failed to send message: {}", e))?;

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
