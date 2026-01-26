//! Configuration structures

use serde::{Deserialize, Serialize};

/// Information about a connected client (for server mode)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectedClientInfo {
    pub client_id: String,
    pub name: String,
    pub monitor_ids: Vec<u32>,
}
