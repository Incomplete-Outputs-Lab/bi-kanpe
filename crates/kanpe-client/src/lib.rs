//! Kanpe Client - WebSocket client for caster mode
//!
//! This crate provides the WebSocket client implementation for the caster
//! (client) role in the Bi-Kanpe system.

mod client;

pub use client::KanpeClient;

// Re-export events for integration
pub mod events {
    use serde::{Serialize, Deserialize};

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub enum ClientEvent {
        ConnectionEstablished {
            server_address: String,
        },
        ConnectionLost {
            reason: String,
        },
        MessageReceived {
            message: kanpe_core::Message,
        },
        ServerWelcomeReceived {
            server_name: String,
        },
        MonitorListReceived {
            monitors: Vec<kanpe_core::types::VirtualMonitor>,
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
        FlashReceived {
            target_monitor_ids: Vec<String>,
        },
        ClearReceived {
            target_monitor_ids: Vec<String>,
        },
    }
}
