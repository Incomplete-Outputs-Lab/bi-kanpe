//! Kanpe Server - WebSocket server for director mode
//!
//! This crate provides the WebSocket server implementation for the director
//! (server) role in the Bi-Kanpe system.

mod server;
mod client_manager;
mod broadcast;
mod monitor_manager;

pub use server::KanpeServer;
pub use monitor_manager::MonitorManager;

// Re-export events for integration
pub mod events {
    use serde::{Serialize, Deserialize};

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub enum ServerEvent {
        ClientConnected {
            client_id: String,
            name: String,
            monitor_ids: Vec<String>,
        },
        ClientDisconnected {
            client_id: String,
        },
        FeedbackReceived {
            message: kanpe_core::Message,
        },
        MonitorAdded {
            monitor: kanpe_core::types::VirtualMonitor,
        },
        MonitorRemoved {
            monitor_id: String,
        },
        MonitorUpdated {
            monitor: kanpe_core::types::VirtualMonitor,
        },
    }
}
