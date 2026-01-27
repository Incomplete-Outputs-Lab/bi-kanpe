//! WebSocket server implementation

use crate::broadcast::broadcast_message;
use crate::client_manager::{ClientInfo, ClientManager};
use crate::events::ServerEvent;
use crate::monitor_manager::MonitorManager;
use futures_util::{SinkExt, StreamExt};
use kanpe_core::Message;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{mpsc, RwLock};
use tokio::time::{interval, Duration};
use tokio_tungstenite::{accept_async, tungstenite::Message as WsMessage};

/// WebSocket server for Kanpe director mode
pub struct KanpeServer {
    client_manager: Arc<ClientManager>,
    monitor_manager: Arc<MonitorManager>,
    event_tx: mpsc::UnboundedSender<ServerEvent>,
    shutdown_tx: Option<mpsc::Sender<()>>,
}

impl KanpeServer {
    /// Create a new KanpeServer
    pub fn new(event_tx: mpsc::UnboundedSender<ServerEvent>) -> Self {
        Self {
            client_manager: Arc::new(ClientManager::new()),
            monitor_manager: Arc::new(MonitorManager::new()),
            event_tx,
            shutdown_tx: None,
        }
    }

    /// Start the WebSocket server on the specified port
    pub async fn start(&mut self, port: u16) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Initialize default monitors
        self.monitor_manager.initialize_default_monitors().await;

        let addr: SocketAddr = format!("0.0.0.0:{}", port).parse()?;
        let listener = TcpListener::bind(&addr).await?;

        let (shutdown_tx, mut shutdown_rx) = mpsc::channel::<()>(1);
        self.shutdown_tx = Some(shutdown_tx);

        let client_manager = self.client_manager.clone();
        let monitor_manager = self.monitor_manager.clone();
        let event_tx = self.event_tx.clone();

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    Ok((stream, peer_addr)) = listener.accept() => {
                        let client_manager = client_manager.clone();
                        let monitor_manager = monitor_manager.clone();
                        let event_tx = event_tx.clone();

                        tokio::spawn(async move {
                            if let Err(e) = handle_connection(stream, peer_addr, client_manager, monitor_manager, event_tx).await {
                                eprintln!("Error handling connection from {}: {}", peer_addr, e);
                            }
                        });
                    }
                    _ = shutdown_rx.recv() => {
                        break;
                    }
                }
            }
        });

        Ok(())
    }

    /// Stop the server
    pub async fn stop(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if let Some(shutdown_tx) = self.shutdown_tx.take() {
            let _ = shutdown_tx.send(()).await;
        }
        Ok(())
    }

    /// Broadcast a message to all connected clients
    pub async fn broadcast_kanpe_message(
        &self,
        message: Message,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        broadcast_message(&self.client_manager, &message).await
    }

    /// Broadcast a flash command to all connected clients
    pub async fn broadcast_flash_command(
        &self,
        message: Message,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        broadcast_message(&self.client_manager, &message).await
    }

    /// Broadcast a clear command to all connected clients
    pub async fn broadcast_clear_command(
        &self,
        message: Message,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        broadcast_message(&self.client_manager, &message).await
    }

    /// Get list of connected clients
    pub async fn get_connected_clients(&self) -> Vec<ClientInfo> {
        self.client_manager.get_all_clients().await
    }

    /// Add a new virtual monitor
    pub async fn add_monitor(
        &self,
        name: String,
        description: Option<String>,
        color: Option<String>,
    ) -> Result<kanpe_core::types::VirtualMonitor, Box<dyn std::error::Error + Send + Sync>> {
        let monitor = self.monitor_manager.add_monitor(name, description, color).await;

        // Broadcast MonitorAdded message to all clients
        let msg = Message::monitor_added(monitor.clone());
        broadcast_message(&self.client_manager, &msg).await?;

        // Emit event
        let _ = self.event_tx.send(ServerEvent::MonitorAdded {
            monitor: monitor.clone(),
        });

        Ok(monitor)
    }

    /// Remove a virtual monitor
    pub async fn remove_monitor(
        &self,
        monitor_id: u32,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if let Some(_monitor) = self.monitor_manager.remove_monitor(monitor_id).await {
            // Broadcast MonitorRemoved message to all clients
            let msg = Message::monitor_removed(monitor_id);
            broadcast_message(&self.client_manager, &msg).await?;

            // Emit event
            let _ = self.event_tx.send(ServerEvent::MonitorRemoved { monitor_id });
        }
        Ok(())
    }

    /// Update a virtual monitor
    pub async fn update_monitor(
        &self,
        monitor: kanpe_core::types::VirtualMonitor,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if self.monitor_manager.update_monitor(monitor.clone()).await {
            // Broadcast MonitorUpdated message to all clients
            let msg = Message::monitor_updated(monitor.clone());
            broadcast_message(&self.client_manager, &msg).await?;

            // Emit event
            let _ = self.event_tx.send(ServerEvent::MonitorUpdated {
                monitor: monitor.clone(),
            });
        }
        Ok(())
    }

    /// Get all virtual monitors
    pub async fn get_monitors(&self) -> Vec<kanpe_core::types::VirtualMonitor> {
        self.monitor_manager.get_all_monitors().await
    }
}

/// Handle a single WebSocket connection
async fn handle_connection(
    stream: TcpStream,
    peer_addr: SocketAddr,
    client_manager: Arc<ClientManager>,
    monitor_manager: Arc<MonitorManager>,
    event_tx: mpsc::UnboundedSender<ServerEvent>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let ws_stream = accept_async(stream).await?;
    let (sink, mut stream) = ws_stream.split();
    let sink = Arc::new(RwLock::new(sink));

    let mut client_id: Option<String> = None;

    // Start ping interval
    let sink_for_ping = sink.clone();
    let ping_task = tokio::spawn(async move {
        let mut interval = interval(Duration::from_secs(30));
        loop {
            interval.tick().await;
            let ping = Message::ping();
            if let Ok(json) = serde_json::to_string(&ping) {
                let mut sink_guard = sink_for_ping.write().await;
                if sink_guard.send(WsMessage::Text(json)).await.is_err() {
                    break;
                }
            }
        }
    });

    // Handle incoming messages
    while let Some(msg) = stream.next().await {
        match msg {
            Ok(WsMessage::Text(text)) => {
                match serde_json::from_str::<Message>(&text) {
                    Ok(message) => {
                        match message {
                            Message::ClientHello { payload, .. } => {
                                // Generate client ID and register client
                                let assigned_client_id = kanpe_core::types::new_id();
                                let info = ClientInfo {
                                    client_id: assigned_client_id.clone(),
                                    client_name: payload.client_name.clone(),
                                    display_monitor_ids: payload.display_monitor_ids.clone(),
                                };

                                client_manager
                                    .add_client(assigned_client_id.clone(), info.clone(), sink.clone())
                                    .await;

                                client_id = Some(assigned_client_id.clone());

                                // Send ServerWelcome
                                let welcome = Message::server_welcome(
                                    "Kanpe Server".to_string(),
                                    assigned_client_id.clone(),
                                );
                                if let Ok(json) = serde_json::to_string(&welcome) {
                                    let mut sink_guard = sink.write().await;
                                    let _ = sink_guard.send(WsMessage::Text(json)).await;
                                }

                                // Send MonitorListSync
                                let monitors = monitor_manager.get_all_monitors().await;
                                let monitor_sync = Message::monitor_list_sync(monitors);
                                if let Ok(json) = serde_json::to_string(&monitor_sync) {
                                    let mut sink_guard = sink.write().await;
                                    let _ = sink_guard.send(WsMessage::Text(json)).await;
                                }

                                // Emit ClientConnected event
                                let _ = event_tx.send(ServerEvent::ClientConnected {
                                    client_id: info.client_id,
                                    name: info.client_name,
                                    monitor_ids: info.display_monitor_ids,
                                });
                            }
                            Message::FeedbackMessage { .. } => {
                                // Emit FeedbackReceived event
                                let _ = event_tx.send(ServerEvent::FeedbackReceived { message });
                            }
                            Message::Pong { .. } => {
                                // Just acknowledge pong, no action needed
                            }
                            Message::Ping { .. } => {
                                // Respond with pong
                                let pong = Message::pong();
                                if let Ok(json) = serde_json::to_string(&pong) {
                                    let mut sink_guard = sink.write().await;
                                    let _ = sink_guard.send(WsMessage::Text(json)).await;
                                }
                            }
                            _ => {
                                // Ignore other message types from client
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to parse message from {}: {}", peer_addr, e);
                    }
                }
            }
            Ok(WsMessage::Close(_)) => {
                break;
            }
            Err(e) => {
                eprintln!("WebSocket error from {}: {}", peer_addr, e);
                break;
            }
            _ => {}
        }
    }

    // Cleanup on disconnect
    ping_task.abort();
    if let Some(id) = client_id {
        client_manager.remove_client(&id).await;
        let _ = event_tx.send(ServerEvent::ClientDisconnected { client_id: id });
    }

    Ok(())
}
