//! WebSocket client implementation

use crate::events::ClientEvent;
use futures_util::{SinkExt, StreamExt};
use kanpe_core::{Message, message::KanpeMessagePayload, types::{VirtualMonitor, timestamp}};
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tokio_tungstenite::{connect_async, tungstenite::Message as WsMessage};

type WsSink = futures_util::stream::SplitSink<
    tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
    >,
    WsMessage,
>;

/// WebSocket client for Kanpe caster mode
pub struct KanpeClient {
    sink: Arc<RwLock<Option<WsSink>>>,
    event_tx: mpsc::UnboundedSender<ClientEvent>,
    disconnect_tx: Option<mpsc::Sender<()>>,
    client_name: Arc<RwLock<String>>,
    latest_message: Arc<RwLock<Option<(String, KanpeMessagePayload)>>>,
    monitors: Arc<RwLock<Vec<VirtualMonitor>>>,
}

impl KanpeClient {
    /// Create a new KanpeClient
    pub fn new(event_tx: mpsc::UnboundedSender<ClientEvent>) -> Self {
        Self {
            sink: Arc::new(RwLock::new(None)),
            event_tx,
            disconnect_tx: None,
            client_name: Arc::new(RwLock::new(String::new())),
            latest_message: Arc::new(RwLock::new(None)),
            monitors: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Connect to a Kanpe server
    pub async fn connect(
        &mut self,
        server_address: &str,
        client_name: String,
        display_monitor_ids: Vec<String>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Connect to WebSocket at /ws endpoint
        let url = if server_address.starts_with("ws://") || server_address.starts_with("wss://") {
            // If already has protocol, append /ws if not present
            if server_address.ends_with("/ws") {
                server_address.to_string()
            } else {
                format!("{}/ws", server_address.trim_end_matches('/'))
            }
        } else {
            // Add protocol and /ws endpoint
            format!("ws://{}/ws", server_address)
        };

        let (ws_stream, _) = connect_async(&url).await?;
        let (sink, mut stream) = ws_stream.split();

        // Store sink
        *self.sink.write().await = Some(sink);

        // Store client name
        *self.client_name.write().await = client_name.clone();

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
        let latest_message = self.latest_message.clone();
        let monitors = self.monitors.clone();

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
                                            Message::KanpeMessage { id, payload, .. } => {
                                                // Store latest message with ID
                                                *latest_message.write().await = Some((id.clone(), payload.clone()));
                                                let _ = event_tx.send(ClientEvent::MessageReceived { 
                                                    message: Message::KanpeMessage { 
                                                        id,
                                                        timestamp: timestamp(),
                                                        payload 
                                                    } 
                                                });
                                            }
                                            Message::MonitorListSync { payload, .. } => {
                                                // Store monitors
                                                *monitors.write().await = payload.monitors.clone();
                                                let _ = event_tx.send(ClientEvent::MonitorListReceived {
                                                    monitors: payload.monitors,
                                                });
                                            }
                                            Message::MonitorAdded { payload, .. } => {
                                                let _ = event_tx.send(ClientEvent::MonitorAdded {
                                                    monitor: payload.monitor,
                                                });
                                            }
                                            Message::MonitorRemoved { payload, .. } => {
                                                let _ = event_tx.send(ClientEvent::MonitorRemoved {
                                                    monitor_id: payload.monitor_id,
                                                });
                                            }
                                            Message::MonitorUpdated { payload, .. } => {
                                                let _ = event_tx.send(ClientEvent::MonitorUpdated {
                                                    monitor: payload.monitor,
                                                });
                                            }
                                            Message::FlashCommand { payload, .. } => {
                                                let _ = event_tx.send(ClientEvent::FlashReceived {
                                                    target_monitor_ids: payload.target_monitor_ids,
                                                });
                                            }
                                            Message::ClearCommand { payload, .. } => {
                                                let _ = event_tx.send(ClientEvent::ClearReceived {
                                                    target_monitor_ids: payload.target_monitor_ids,
                                                });
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

    /// Get the client name
    pub fn get_client_name(&self) -> Option<String> {
        tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(async {
                let name = self.client_name.read().await;
                if name.is_empty() {
                    None
                } else {
                    Some(name.clone())
                }
            })
        })
    }

    /// Get the latest received message with its ID
    pub fn get_latest_message(&self) -> Option<(String, KanpeMessagePayload)> {
        tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(async {
                self.latest_message.read().await.clone()
            })
        })
    }

    /// Get the list of monitors
    pub fn get_monitors(&self) -> Vec<VirtualMonitor> {
        tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(async {
                self.monitors.read().await.clone()
            })
        })
    }
}
