use serde::{Deserialize, Serialize};
use kanpe_core::types::VirtualMonitor;

/// Messages from StreamDeck plugin to the caster app
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StreamDeckRequest {
    /// Send a new feedback message
    SendFeedback {
        content: String,
        feedback_type: String,
    },
    /// React to the latest received message
    ReactToLatest {
        feedback_type: String,
    },
    /// Request current state
    GetState,
}

/// Messages from caster app to StreamDeck plugin
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StreamDeckResponse {
    /// Result of an operation
    Result {
        success: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<String>,
    },
    /// Current state update
    StateUpdate {
        connected: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        latest_message: Option<LatestMessageInfo>,
        monitors: Vec<VirtualMonitor>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatestMessageInfo {
    pub id: String,
    pub content: String,
    pub priority: String,
    pub target_monitor_ids: Vec<String>,
}

impl StreamDeckResponse {
    pub fn success() -> Self {
        Self::Result {
            success: true,
            error: None,
        }
    }

    pub fn error(message: impl Into<String>) -> Self {
        Self::Result {
            success: false,
            error: Some(message.into()),
        }
    }
}
