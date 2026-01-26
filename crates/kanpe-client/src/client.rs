//! WebSocket client implementation

use crate::events::ClientEvent;
use futures_util::{SinkExt, StreamExt};
use kanpe_core::Message;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tokio_tungstenite::{connect_async, tungstenite::Message as WsMessage};

type WsSink = futures_util::stream::SplitSink<
    tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
    >,
    WsMessage,
>;

/// WebSocket client for Kanpe performer mode
pub struct KanpeClient {
    sink: Arc<RwLock<Option<WsSink>>>,
    event_tx: mpsc::UnboundedSender<ClientEvent>,
    disconnect_tx: Option<mpsc::Sender<()>>,
}

impl KanpeClient {
    /// Create a new KanpeClient
    pub fn new(event_tx: mpsc::UnboundedSender<ClientEvent>) -> Self {
        Self {
            sink: Arc::new(RwLock::new(None)),
            event_tx,
            disconnect_tx: None,
        }
    }

    /// Connect to a Kanpe server
    pub async fn connect(
        &mut self,
        server_address: &str,
        client_name: String,
        display_monitor_ids: Vec<u32>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Connect to WebSocket
        let url = if server_address.starts_with("ws://") || server_address.starts_with("wss://") {
            server_address.to_string()
        } else {
            format!("ws://{}", server_address)
        };

        let (ws_stream, _) = connect_async(&url).await?;
        let (sink, mut stream) = ws_stream.split();

        // Store sink
        *self.sink.write().await = Some(sink);

        // Send ClientHello
        let hello = Message::client_hello(client_name, display_monitor_ids);
        self.send_internal(&hello).await?;

        // Set up disconnect channel
        let (disconnect_tx, mut disconnect_rx) = mpsc::channel::<()>(1);
        self.disconnect_tx = Some(disconnect_tx);

        // Spawn task to handle incoming messages
        let event_tx = self.event_tx.clone();
        let sink_for_handler = self.sink.clone();
        let server_addr = server_address.to_string();

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    msg = stream.next() => {
                        match msg {
                            Some(Ok(WsMessage::Text(text))) => {
                                match serde_json::from_str::<Message>(&text) {
                                    Ok(message) => {
                                        match message {
                                            Message::ServerWelcome { payload, .. } => {
                                                let _ = event_tx.send(ClientEvent::ServerWelcomeReceived {
                                                    server_name: payload.server_name,
                                                });
                                                let _ = event_tx.send(ClientEvent::ConnectionEstablished {
                                                    server_address: server_addr.clone(),
                                                });
                                            }
                                            Message::KanpeMessage { .. } => {
                                                let _ = event_tx.send(ClientEvent::MessageReceived { message });
                                            }
                                            Message::Ping { .. } => {
                                                // Respond with pong
                                                let pong = Message::pong();
                                                if let Ok(json) = serde_json::to_string(&pong) {
                                                    if let Some(sink) = sink_for_handler.write().await.as_mut() {
                                                        let _ = sink.send(WsMessage::Text(json)).await;
                                                    }
                                                }
                                            }
                                            _ => {
                                                // Ignore other message types
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        eprintln!("Failed to parse message: {}", e);
                                    }
                                }
                            }
                            Some(Ok(WsMessage::Close(_))) => {
                                let _ = event_tx.send(ClientEvent::ConnectionLost {
                                    reason: "Server closed connection".to_string(),
                                });
                                break;
                            }
                            Some(Err(e)) => {
                                let _ = event_tx.send(ClientEvent::ConnectionLost {
                                    reason: format!("WebSocket error: {}", e),
                                });
                                break;
                            }
                            None => {
                                let _ = event_tx.send(ClientEvent::ConnectionLost {
                                    reason: "Connection closed".to_string(),
                                });
                                break;
                            }
                            _ => {}
                        }
                    }
                    _ = disconnect_rx.recv() => {
                        break;
                    }
                }
            }

            // Clear sink on disconnect
            *sink_for_handler.write().await = None;
        });

        Ok(())
    }

    /// Disconnect from server
    pub async fn disconnect(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if let Some(disconnect_tx) = self.disconnect_tx.take() {
            let _ = disconnect_tx.send(()).await;
        }

        // Close WebSocket connection
        if let Some(sink) = self.sink.write().await.as_mut() {
            let _ = sink.send(WsMessage::Close(None)).await;
        }

        *self.sink.write().await = None;

        Ok(())
    }

    /// Send a message to the server
    pub async fn send_message(
        &self,
        message: &Message,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.send_internal(message).await
    }

    /// Internal method to send a message
    async fn send_internal(
        &self,
        message: &Message,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let json = serde_json::to_string(message)?;
        let ws_message = WsMessage::Text(json);

        if let Some(sink) = self.sink.write().await.as_mut() {
            sink.send(ws_message).await?;
            Ok(())
        } else {
            Err("Not connected".into())
        }
    }

    /// Check if connected
    pub async fn is_connected(&self) -> bool {
        self.sink.read().await.is_some()
    }
}
