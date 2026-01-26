//! Application state management

use kanpe_client::KanpeClient;
use kanpe_server::KanpeServer;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Application mode
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AppMode {
    NotSelected,
    Server,
    Client,
}

/// Global application state
pub struct AppState {
    pub mode: Arc<RwLock<AppMode>>,
    pub server: Arc<RwLock<Option<KanpeServer>>>,
    pub client: Arc<RwLock<Option<KanpeClient>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            mode: Arc::new(RwLock::new(AppMode::NotSelected)),
            server: Arc::new(RwLock::new(None)),
            client: Arc::new(RwLock::new(None)),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
