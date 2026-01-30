use anyhow::Result;
use axum::{
    extract::{
        ws::{Message as WsMessage, WebSocket},
        State, WebSocketUpgrade,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use futures_util::{stream::SplitSink, SinkExt, StreamExt};
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};

use crate::protocol::{StreamDeckRequest, StreamDeckResponse};

pub type StreamDeckEventSender = mpsc::UnboundedSender<StreamDeckEvent>;
pub type StreamDeckEventReceiver = mpsc::UnboundedReceiver<StreamDeckEvent>;

/// Events emitted by the StreamDeck server
#[derive(Debug, Clone)]
pub enum StreamDeckEvent {
    /// A StreamDeck client connected
    Connected,
    /// A StreamDeck client disconnected
    Disconnected,
    /// Send feedback request received
    SendFeedback {
        content: String,
        feedback_type: String,
    },
    /// React to latest message request received
    ReactToLatest {
        feedback_type: String,
    },
    /// Get state request received
    GetState,
}

struct AppState {
    event_tx: StreamDeckEventSender,
    ws_sender: Arc<RwLock<Option<SplitSink<WebSocket, WsMessage>>>>,
}

pub struct StreamDeckServer {
    port: u16,
    shutdown_tx: mpsc::Sender<()>,
    ws_sender: Arc<RwLock<Option<SplitSink<WebSocket, WsMessage>>>>,
}

impl StreamDeckServer {
    pub async fn new(port: u16, event_tx: StreamDeckEventSender) -> Result<Self> {
        let (shutdown_tx, mut shutdown_rx) = mpsc::channel::<()>(1);
        let ws_sender = Arc::new(RwLock::new(None));

        let app_state = Arc::new(AppState {
            event_tx: event_tx.clone(),
            ws_sender: ws_sender.clone(),
        });

        let app = Router::new()
            .route("/ws", get(ws_handler))
            .with_state(app_state);

        let addr = format!("127.0.0.1:{}", port);
        let listener = tokio::net::TcpListener::bind(&addr).await?;

        tokio::spawn(async move {
            axum::serve(listener, app)
                .with_graceful_shutdown(async move {
                    shutdown_rx.recv().await;
                })
                .await
                .ok();
        });

        Ok(Self {
            port,
            shutdown_tx,
            ws_sender,
        })
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    pub async fn send_response(&self, response: StreamDeckResponse) -> Result<()> {
        let mut sender_lock = self.ws_sender.write().await;
        if let Some(sender) = sender_lock.as_mut() {
            let json = serde_json::to_string(&response)?;
            sender.send(WsMessage::Text(json)).await?;
        }
        Ok(())
    }

    pub async fn shutdown(self) -> Result<()> {
        self.shutdown_tx.send(()).await?;
        Ok(())
    }
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (sender, mut receiver) = socket.split();
    
    // Store the sender for sending responses
    {
        let mut ws_sender = state.ws_sender.write().await;
        *ws_sender = Some(sender);
    }

    // Notify connection
    let _ = state.event_tx.send(StreamDeckEvent::Connected);

    // Handle incoming messages
    while let Some(Ok(msg)) = receiver.next().await {
        if let WsMessage::Text(text) = msg {
            if let Ok(request) = serde_json::from_str::<StreamDeckRequest>(&text) {
                let event = match request {
                    StreamDeckRequest::SendFeedback {
                        content,
                        feedback_type,
                    } => StreamDeckEvent::SendFeedback {
                        content,
                        feedback_type,
                    },
                    StreamDeckRequest::ReactToLatest { feedback_type } => {
                        StreamDeckEvent::ReactToLatest { feedback_type }
                    }
                    StreamDeckRequest::GetState => StreamDeckEvent::GetState,
                };

                let _ = state.event_tx.send(event);
            }
        } else if let WsMessage::Close(_) = msg {
            break;
        }
    }

    // Clear the sender on disconnect
    {
        let mut ws_sender = state.ws_sender.write().await;
        *ws_sender = None;
    }

    // Notify disconnection
    let _ = state.event_tx.send(StreamDeckEvent::Disconnected);
}
