//! Client connection management

use futures_util::stream::SplitSink;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::net::TcpStream;
use tokio::sync::RwLock;
use tokio_tungstenite::{tungstenite::Message as WsMessage, WebSocketStream};

pub type WsSink = SplitSink<WebSocketStream<TcpStream>, WsMessage>;

/// Information about a connected client
#[derive(Debug, Clone)]
pub struct ClientInfo {
    pub client_id: String,
    pub client_name: String,
    pub display_monitor_ids: Vec<String>,
}

/// Manager for tracking connected clients
pub struct ClientManager {
    clients: Arc<RwLock<HashMap<String, (ClientInfo, Arc<RwLock<WsSink>>)>>>,
}

impl ClientManager {
    pub fn new() -> Self {
        Self {
            clients: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Add a new client
    pub async fn add_client(
        &self,
        client_id: String,
        info: ClientInfo,
        sink: Arc<RwLock<WsSink>>,
    ) {
        self.clients.write().await.insert(client_id, (info, sink));
    }

    /// Remove a client
    pub async fn remove_client(&self, client_id: &str) -> Option<ClientInfo> {
        self.clients
            .write()
            .await
            .remove(client_id)
            .map(|(info, _)| info)
    }

    /// Get all client infos
    pub async fn get_all_clients(&self) -> Vec<ClientInfo> {
        self.clients
            .read()
            .await
            .values()
            .map(|(info, _)| info.clone())
            .collect()
    }

    /// Get all client sinks for broadcasting
    pub async fn get_all_sinks(&self) -> Vec<(String, Arc<RwLock<WsSink>>)> {
        self.clients
            .read()
            .await
            .iter()
            .map(|(id, (_, sink))| (id.clone(), sink.clone()))
            .collect()
    }

    /// Check if client exists
    #[allow(dead_code)]
    pub async fn has_client(&self, client_id: &str) -> bool {
        self.clients.read().await.contains_key(client_id)
    }
}

impl Default for ClientManager {
    fn default() -> Self {
        Self::new()
    }
}
