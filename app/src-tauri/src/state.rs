//! Application state management

use kanpe_client::KanpeClient;
use kanpe_server::KanpeServer;
use kanpe_streamdeck_server::StreamDeckServer;
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
    pub streamdeck_server: Arc<RwLock<Option<StreamDeckServer>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            mode: Arc::new(RwLock::new(AppMode::NotSelected)),
            server: Arc::new(RwLock::new(None)),
            client: Arc::new(RwLock::new(None)),
            streamdeck_server: Arc::new(RwLock::new(None)),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
