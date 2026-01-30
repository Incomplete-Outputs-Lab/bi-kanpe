//! Broadcasting logic for sending messages to clients

use crate::client_manager::ClientManager;
use axum::extract::ws::Message as WsMessage;
use futures_util::SinkExt;
use kanpe_core::Message;

/// Broadcast a message to all connected clients
pub async fn broadcast_message(
    client_manager: &ClientManager,
    message: &Message,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let json = serde_json::to_string(message)?;
    let ws_message = WsMessage::Text(json);

    let sinks = client_manager.get_all_sinks().await;

    for (_client_id, sink) in sinks {
        let mut sink_guard = sink.write().await;
        // Ignore individual send failures (client will be cleaned up by disconnect handler)
        let _ = sink_guard.send(ws_message.clone()).await;
    }

    Ok(())
}
