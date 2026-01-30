//! StreamDeck integration Tauri commands

use crate::state::AppState;
use kanpe_client::KanpeClient;
use kanpe_core::{FeedbackType, Message};
use kanpe_streamdeck_server::{StreamDeckEvent, StreamDeckResponse, StreamDeckServer, protocol::LatestMessageInfo};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::{mpsc, RwLock};
use std::sync::Arc;

/// Start the StreamDeck WebSocket server
#[tauri::command]
pub async fn start_streamdeck_server(
    port: u16,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<u16, String> {
    // Check if already running
    {
        let server_lock = state.streamdeck_server.read().await;
        if server_lock.is_some() {
            return Err("StreamDeck server is already running".to_string());
        }
    }

    // Create event channel
    let (event_tx, mut event_rx) = mpsc::unbounded_channel::<StreamDeckEvent>();

    // Create server
    let server = StreamDeckServer::new(port, event_tx)
        .await
        .map_err(|e| format!("Failed to start StreamDeck server: {}", e))?;

    let actual_port = server.port();

    // Store server in state
    *state.streamdeck_server.write().await = Some(server);

    // Spawn task to handle StreamDeck events
    let client_arc = state.client.clone();
    let streamdeck_arc = state.streamdeck_server.clone();
    let app_handle_clone = app_handle.clone();
    tokio::spawn(async move {
        while let Some(event) = event_rx.recv().await {
            match event {
                StreamDeckEvent::Connected => {
                    let _ = app_handle_clone.emit("streamdeck_connected", ());
                }
                StreamDeckEvent::Disconnected => {
                    let _ = app_handle_clone.emit("streamdeck_disconnected", ());
                }
                StreamDeckEvent::SendFeedback {
                    content,
                    feedback_type,
                } => {
                    // Get client and send feedback
                    let result = send_feedback_internal(
                        &client_arc,
                        content,
                        feedback_type,
                    )
                    .await;

                    // Send response back to StreamDeck
                    let response = match result {
                        Ok(_) => StreamDeckResponse::success(),
                        Err(e) => StreamDeckResponse::error(e),
                    };

                    if let Some(server) = streamdeck_arc.read().await.as_ref() {
                        let _ = server.send_response(response).await;
                    }
                }
                StreamDeckEvent::ReactToLatest { feedback_type } => {
                    // Get latest message and send feedback
                    let result = react_to_latest_internal(
                        &client_arc,
                        feedback_type,
                    )
                    .await;

                    // Send response back to StreamDeck
                    let response = match result {
                        Ok(_) => StreamDeckResponse::success(),
                        Err(e) => StreamDeckResponse::error(e),
                    };

                    if let Some(server) = streamdeck_arc.read().await.as_ref() {
                        let _ = server.send_response(response).await;
                    }
                }
                StreamDeckEvent::GetState => {
                    // Get current state and send to StreamDeck
                    let (connected, latest_message, monitors) = {
                        let client_lock = client_arc.read().await;
                        if let Some(client) = client_lock.as_ref() {
                            let latest = client.get_latest_message().map(|(id, payload)| {
                                LatestMessageInfo {
                                    id,
                                    content: payload.content,
                                    priority: format!("{:?}", payload.priority).to_lowercase(),
                                    target_monitor_ids: payload.target_monitor_ids,
                                }
                            });
                            let monitors = client.get_monitors();
                            (true, latest, monitors)
                        } else {
                            (false, None, vec![])
                        }
                    };

                    let response = StreamDeckResponse::StateUpdate {
                        connected,
                        latest_message,
                        monitors,
                    };

                    if let Some(server) = streamdeck_arc.read().await.as_ref() {
                        let _ = server.send_response(response).await;
                    }
                }
            }
        }
    });

    Ok(actual_port)
}

/// Stop the StreamDeck WebSocket server
#[tauri::command]
pub async fn stop_streamdeck_server(state: State<'_, AppState>) -> Result<(), String> {
    let mut server_lock = state.streamdeck_server.write().await;
    if let Some(server) = server_lock.take() {
        server
            .shutdown()
            .await
            .map_err(|e| format!("Failed to stop StreamDeck server: {}", e))?;
        Ok(())
    } else {
        Err("StreamDeck server is not running".to_string())
    }
}

/// Get StreamDeck server status
#[tauri::command]
pub async fn get_streamdeck_status(state: State<'_, AppState>) -> Result<bool, String> {
    let server_lock = state.streamdeck_server.read().await;
    Ok(server_lock.is_some())
}

// Internal helper functions

async fn send_feedback_internal(
    client_arc: &Arc<RwLock<Option<KanpeClient>>>,
    content: String,
    feedback_type_str: String,
) -> Result<(), String> {
    // Parse feedback type
    let feedback_type = match feedback_type_str.as_str() {
        "Ack" => FeedbackType::Ack,
        "Question" => FeedbackType::Question,
        "Issue" => FeedbackType::Issue,
        "Info" => FeedbackType::Info,
        _ => return Err(format!("Invalid feedback type: {}", feedback_type_str)),
    };

    // Get client
    let client_lock = client_arc.read().await;
    let client = client_lock
        .as_ref()
        .ok_or("Not connected to a server")?;

    // Get client name
    let client_name = client
        .get_client_name()
        .unwrap_or("StreamDeck".to_string());

    // Create and send feedback message
    let message = Message::feedback_message(content, client_name, String::new(), feedback_type);
    client
        .send_message(&message)
        .await
        .map_err(|e| format!("Failed to send feedback: {}", e))?;

    Ok(())
}

async fn react_to_latest_internal(
    client_arc: &Arc<RwLock<Option<KanpeClient>>>,
    feedback_type_str: String,
) -> Result<(), String> {
    // Parse feedback type
    let feedback_type = match feedback_type_str.as_str() {
        "Ack" => FeedbackType::Ack,
        "Question" => FeedbackType::Question,
        "Issue" => FeedbackType::Issue,
        "Info" => FeedbackType::Info,
        _ => return Err(format!("Invalid feedback type: {}", feedback_type_str)),
    };

    // Get client and latest message
    let client_lock = client_arc.read().await;
    let client = client_lock
        .as_ref()
        .ok_or("Not connected to a server")?;

    let (message_id, _payload) = client
        .get_latest_message()
        .ok_or("No messages received yet")?;

    let client_name = client
        .get_client_name()
        .unwrap_or("StreamDeck".to_string());

    // Create acknowledgment content
    let content = match feedback_type {
        FeedbackType::Ack => "了解しました".to_string(),
        FeedbackType::Question => "質問があります".to_string(),
        FeedbackType::Issue => "問題が発生しました".to_string(),
        FeedbackType::Info => "情報を共有します".to_string(),
    };

    // Create and send feedback message
    let message = Message::feedback_message(content, client_name, message_id, feedback_type);
    client
        .send_message(&message)
        .await
        .map_err(|e| format!("Failed to send feedback: {}", e))?;

    Ok(())
}
