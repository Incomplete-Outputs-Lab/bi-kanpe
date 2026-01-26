//! Kanpe Server - WebSocket server for director mode
//!
//! This crate provides the WebSocket server implementation for the director
//! (server) role in the Bi-Kanpe system.

mod server;
mod client_manager;
mod broadcast;

pub use server::KanpeServer;

// Re-export events for integration
pub mod events {
    use serde::{Serialize, Deserialize};

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub enum ServerEvent {
        ClientConnected {
            client_id: String,
            name: String,
            monitor_ids: Vec<u32>,
        },
        ClientDisconnected {
            client_id: String,
        },
        FeedbackReceived {
            message: kanpe_core::Message,
        },
    }
}
