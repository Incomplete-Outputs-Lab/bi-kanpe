//! Client-mode Tauri commands

use crate::state::{AppMode, AppState};
use kanpe_client::events::ClientEvent;
use kanpe_client::KanpeClient;
use kanpe_core::{FeedbackType, Message};
use tauri::{AppHandle, Emitter, State, Manager, WebviewUrl, WebviewWindowBuilder};
use tokio::sync::mpsc;

/// Connect to a Kanpe server
#[tauri::command]
pub async fn connect_to_server(
    server_address: String,
    client_name: String,
    display_monitor_ids: Vec<u32>,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Check mode
    let mode = state.mode.read().await;
    if *mode == AppMode::Server {
        return Err("Cannot connect to server while in server mode".to_string());
    }
    drop(mode);

    // Set mode to Client
    *state.mode.write().await = AppMode::Client;

    // Create event channel
    let (event_tx, mut event_rx) = mpsc::unbounded_channel::<ClientEvent>();

    // Create and connect client
    let mut client = KanpeClient::new(event_tx);
    client
        .connect(&server_address, client_name, display_monitor_ids)
        .await
        .map_err(|e| format!("Failed to connect to server: {}", e))?;

    // Store client in state
    *state.client.write().await = Some(client);

    // Spawn task to handle client events
    tokio::spawn(async move {
        while let Some(event) = event_rx.recv().await {
            match event {
                ClientEvent::ConnectionEstablished { server_address } => {
                    let _ = app_handle.emit(
                        "connection_established",
                        serde_json::json!({
                            "server_address": server_address,
                        }),
                    );
                }
                ClientEvent::ConnectionLost { reason } => {
                    let _ = app_handle.emit(
                        "connection_lost",
                        serde_json::json!({
                            "reason": reason,
                        }),
                    );
                }
                ClientEvent::MessageReceived { message } => {
                    let _ = app_handle.emit("kanpe_message_received", message);
                }
                ClientEvent::ServerWelcomeReceived { server_name } => {
                    let _ = app_handle.emit(
                        "server_welcome_received",
                        serde_json::json!({
                            "server_name": server_name,
                        }),
                    );
                }
                ClientEvent::MonitorListReceived { monitors } => {
                    let _ = app_handle.emit("monitor_list_received", monitors);
                }
                ClientEvent::MonitorAdded { monitor } => {
                    let _ = app_handle.emit("monitor_added", monitor);
                }
                ClientEvent::MonitorRemoved { monitor_id } => {
                    let _ = app_handle.emit(
                        "monitor_removed",
                        serde_json::json!({ "monitor_id": monitor_id }),
                    );
                }
                ClientEvent::MonitorUpdated { monitor } => {
                    let _ = app_handle.emit("monitor_updated", monitor);
                }
            }
        }
    });

    Ok(())
}

/// Disconnect from the Kanpe server
#[tauri::command]
pub async fn disconnect_from_server(state: State<'_, AppState>) -> Result<(), String> {
    let mut client = state.client.write().await;
    if let Some(c) = client.take() {
        let mut c = c;
        c.disconnect()
            .await
            .map_err(|e| format!("Failed to disconnect: {}", e))?;
    }

    // Reset mode
    *state.mode.write().await = AppMode::NotSelected;

    Ok(())
}

/// Send feedback to the server
#[tauri::command]
pub async fn send_feedback(
    content: String,
    client_name: String,
    reply_to_message_id: String,
    feedback_type: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let client = state.client.read().await;
    if let Some(client) = client.as_ref() {
        // Parse feedback type
        let feedback_type = match feedback_type.to_lowercase().as_str() {
            "question" => FeedbackType::Question,
            "issue" => FeedbackType::Issue,
            "info" => FeedbackType::Info,
            _ => FeedbackType::Ack,
        };

        // Create and send feedback message
        let message = Message::feedback_message(
            content,
            client_name,
            reply_to_message_id,
            feedback_type,
        );
        client
            .send_message(&message)
            .await
            .map_err(|e| format!("Failed to send feedback: {}", e))?;

        Ok(())
    } else {
        Err("Not connected to server".to_string())
    }
}

/// Create a popout window for a specific monitor
#[tauri::command]
pub async fn create_popout_window(
    monitor_id: u32,
    monitor_name: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    let label = format!("popout-monitor-{}", monitor_id);
    let url = format!("index.html?popout=true&monitor_id={}", monitor_id);
    let title = format!("Monitor: {}", monitor_name);

    // Check if window already exists
    if app_handle.get_webview_window(&label).is_some() {
        return Err(format!("Window for monitor {} already exists", monitor_id));
    }

    // Create new window
    WebviewWindowBuilder::new(&app_handle, &label, WebviewUrl::App(url.into()))
        .title(&title)
        .inner_size(800.0, 600.0)
        .build()
        .map_err(|e| format!("Failed to create window: {}", e))?;

    Ok(())
}

/// Close a popout window
#[tauri::command]
pub async fn close_popout_window(
    monitor_id: u32,
    app_handle: AppHandle,
) -> Result<(), String> {
    let label = format!("popout-monitor-{}", monitor_id);

    if let Some(window) = app_handle.get_webview_window(&label) {
        window
            .close()
            .map_err(|e| format!("Failed to close window: {}", e))?;
        Ok(())
    } else {
        Err(format!("Window for monitor {} not found", monitor_id))
    }
}
