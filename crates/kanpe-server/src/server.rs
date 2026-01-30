//! HTTP + WebSocket server implementation

use crate::broadcast::broadcast_message;
use crate::client_manager::{ClientInfo, ClientManager};
use crate::events::ServerEvent;
use crate::monitor_manager::MonitorManager;
use axum::{
    extract::{ws::WebSocketUpgrade, State},
    response::Response,
    routing::get,
    Router,
};
use axum::extract::ws::{Message as WsMessage, WebSocket};
use futures_util::{SinkExt, StreamExt};
use kanpe_core::Message;
use rust_embed::RustEmbed;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tokio::time::{interval, Duration};
use tower_http::cors::CorsLayer;

#[derive(RustEmbed)]
#[folder = "web-caster/"]
struct WebAssets;

/// Shared application state
#[derive(Clone)]
struct AppState {
    client_manager: Arc<ClientManager>,
    monitor_manager: Arc<MonitorManager>,
    event_tx: mpsc::UnboundedSender<ServerEvent>,
}

/// HTTP + WebSocket server for Kanpe director mode
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

    /// Start the HTTP + WebSocket server on the specified port
    pub async fn start(&mut self, port: u16) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Initialize default monitors
        self.monitor_manager.initialize_default_monitors().await;

        let state = AppState {
            client_manager: self.client_manager.clone(),
            monitor_manager: self.monitor_manager.clone(),
            event_tx: self.event_tx.clone(),
        };

        // Build router with static file serving and WebSocket endpoint
        let app = Router::new()
            .route("/", get(serve_index))
            .route("/styles.css", get(serve_css))
            .route("/app.js", get(serve_js))
            .route("/ws", get(websocket_handler))
            .layer(CorsLayer::permissive())
            .with_state(state);

        let addr = format!("0.0.0.0:{}", port);
        let listener = tokio::net::TcpListener::bind(&addr).await?;

        let (shutdown_tx, mut shutdown_rx) = mpsc::channel::<()>(1);
        self.shutdown_tx = Some(shutdown_tx);

        tokio::spawn(async move {
            axum::serve(listener, app)
                .with_graceful_shutdown(async move {
                    shutdown_rx.recv().await;
                })
                .await
                .expect("Server error");
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
    pub async fn broadcast_message(
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
        monitor_id: String,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if let Some(_monitor) = self.monitor_manager.remove_monitor(monitor_id.clone()).await {
            // Broadcast MonitorRemoved message to all clients
            let msg = Message::monitor_removed(monitor_id.clone());
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

/// Serve index.html
async fn serve_index() -> Response {
    serve_static_file("index.html", "text/html")
}

/// Serve styles.css
async fn serve_css() -> Response {
    serve_static_file("styles.css", "text/css")
}

/// Serve app.js
async fn serve_js() -> Response {
    serve_static_file("app.js", "application/javascript")
}

/// Generic static file server
fn serve_static_file(path: &str, content_type: &str) -> Response {
    match WebAssets::get(path) {
        Some(content) => {
            let body = content.data.into_owned();
            Response::builder()
                .header("Content-Type", content_type)
                .body(body.into())
                .unwrap()
        }
        None => Response::builder()
            .status(404)
            .body("Not Found".into())
            .unwrap(),
    }
}

/// WebSocket upgrade handler
async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> Response {
    ws.on_upgrade(move |socket| handle_websocket(socket, state))
}

/// Handle a WebSocket connection
async fn handle_websocket(socket: WebSocket, state: AppState) {
    let (sink, mut stream) = socket.split();
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

                                state.client_manager
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
                                let monitors = state.monitor_manager.get_all_monitors().await;
                                let monitor_sync = Message::monitor_list_sync(monitors);
                                if let Ok(json) = serde_json::to_string(&monitor_sync) {
                                    let mut sink_guard = sink.write().await;
                                    let _ = sink_guard.send(WsMessage::Text(json)).await;
                                }

                                // Emit ClientConnected event
                                let _ = state.event_tx.send(ServerEvent::ClientConnected {
                                    client_id: info.client_id,
                                    name: info.client_name,
                                    monitor_ids: info.display_monitor_ids,
                                });
                            }
                            Message::FeedbackMessage { .. } => {
                                // Emit FeedbackReceived event
                                let _ = state.event_tx.send(ServerEvent::FeedbackReceived { message });
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
                        eprintln!("Failed to parse message: {}", e);
                    }
                }
            }
            Ok(WsMessage::Close(_)) => {
                break;
            }
            Err(e) => {
                eprintln!("WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }

    // Cleanup on disconnect
    ping_task.abort();
    if let Some(id) = client_id {
        state.client_manager.remove_client(&id).await;
        let _ = state.event_tx.send(ServerEvent::ClientDisconnected { client_id: id });
    }
}
