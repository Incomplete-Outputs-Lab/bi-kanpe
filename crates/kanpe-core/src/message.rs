//! Message types for the Kanpe protocol

use serde::{Deserialize, Serialize};
use crate::types::{new_id, timestamp, Priority, FeedbackType, VirtualMonitor};

/// Main message enum for all Kanpe protocol messages
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Message {
    /// Client sends this on connection to introduce itself
    ClientHello {
        id: String,
        timestamp: i64,
        payload: ClientHelloPayload,
    },
    /// Server responds with this to confirm connection
    ServerWelcome {
        id: String,
        timestamp: i64,
        payload: ServerWelcomePayload,
    },
    /// Server sends cue card messages to clients
    KanpeMessage {
        id: String,
        timestamp: i64,
        payload: KanpeMessagePayload,
    },
    /// Client sends feedback to server
    FeedbackMessage {
        id: String,
        timestamp: i64,
        payload: FeedbackMessagePayload,
    },
    /// Keepalive ping from either side
    Ping {
        id: String,
        timestamp: i64,
    },
    /// Keepalive pong response
    Pong {
        id: String,
        timestamp: i64,
    },
    /// Server sends monitor list synchronization
    MonitorListSync {
        id: String,
        timestamp: i64,
        payload: MonitorListSyncPayload,
    },
    /// Server notifies monitor was added
    MonitorAdded {
        id: String,
        timestamp: i64,
        payload: MonitorAddedPayload,
    },
    /// Server notifies monitor was removed
    MonitorRemoved {
        id: String,
        timestamp: i64,
        payload: MonitorRemovedPayload,
    },
    /// Server notifies monitor was updated
    MonitorUpdated {
        id: String,
        timestamp: i64,
        payload: MonitorUpdatedPayload,
    },
    /// Server sends flash command to clients
    FlashCommand {
        id: String,
        timestamp: i64,
        payload: FlashCommandPayload,
    },
    /// Server sends clear command to clients
    ClearCommand {
        id: String,
        timestamp: i64,
        payload: ClearCommandPayload,
    },
}

/// Payload for ClientHello message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientHelloPayload {
    /// Client's display name
    pub client_name: String,
    /// Virtual monitor IDs this client is displaying (e.g., ["A", "B"])
    pub display_monitor_ids: Vec<String>,
}

/// Payload for ServerWelcome message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerWelcomePayload {
    /// Server's display name
    pub server_name: String,
    /// Client ID assigned by server
    pub assigned_client_id: String,
}

/// Payload for KanpeMessage (cue card)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanpeMessagePayload {
    /// Message content (text)
    pub content: String,
    /// Target virtual monitor IDs ("ALL" = all monitors, or specific IDs like ["A", "B"])
    pub target_monitor_ids: Vec<String>,
    /// Message priority
    pub priority: Priority,
}

/// Payload for FeedbackMessage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeedbackMessagePayload {
    /// Feedback content (text)
    pub content: String,
    /// Client name who sent the feedback
    pub client_name: String,
    /// ID of message being replied to
    pub reply_to_message_id: String,
    /// Type of feedback
    pub feedback_type: FeedbackType,
}

/// Payload for MonitorListSync message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorListSyncPayload {
    /// List of all available monitors
    pub monitors: Vec<VirtualMonitor>,
}

/// Payload for MonitorAdded message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorAddedPayload {
    /// The newly added monitor
    pub monitor: VirtualMonitor,
}

/// Payload for MonitorRemoved message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorRemovedPayload {
    /// ID of the removed monitor
    pub monitor_id: String,
}

/// Payload for MonitorUpdated message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorUpdatedPayload {
    /// The updated monitor
    pub monitor: VirtualMonitor,
}

/// Payload for FlashCommand
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlashCommandPayload {
    /// Target virtual monitor IDs ("ALL" = all monitors, or specific IDs like ["A", "B"])
    pub target_monitor_ids: Vec<String>,
}

/// Payload for ClearCommand
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClearCommandPayload {
    /// Target virtual monitor IDs ("ALL" = all monitors, or specific IDs like ["A", "B"])
    pub target_monitor_ids: Vec<String>,
}

impl Message {
    /// Create a new ClientHello message
    pub fn client_hello(client_name: String, display_monitor_ids: Vec<String>) -> Self {
        Message::ClientHello {
            id: new_id(),
            timestamp: timestamp(),
            payload: ClientHelloPayload {
                client_name,
                display_monitor_ids,
            },
        }
    }

    /// Create a new ServerWelcome message
    pub fn server_welcome(server_name: String, assigned_client_id: String) -> Self {
        Message::ServerWelcome {
            id: new_id(),
            timestamp: timestamp(),
            payload: ServerWelcomePayload {
                server_name,
                assigned_client_id,
            },
        }
    }

    /// Create a new KanpeMessage
    pub fn kanpe_message(
        content: String,
        target_monitor_ids: Vec<String>,
        priority: Priority,
    ) -> Self {
        Message::KanpeMessage {
            id: new_id(),
            timestamp: timestamp(),
            payload: KanpeMessagePayload {
                content,
                target_monitor_ids,
                priority,
            },
        }
    }

    /// Create a new FeedbackMessage
    pub fn feedback_message(
        content: String,
        client_name: String,
        reply_to_message_id: String,
        feedback_type: FeedbackType,
    ) -> Self {
        Message::FeedbackMessage {
            id: new_id(),
            timestamp: timestamp(),
            payload: FeedbackMessagePayload {
                content,
                client_name,
                reply_to_message_id,
                feedback_type,
            },
        }
    }

    /// Create a new Ping message
    pub fn ping() -> Self {
        Message::Ping {
            id: new_id(),
            timestamp: timestamp(),
        }
    }

    /// Create a new Pong message
    pub fn pong() -> Self {
        Message::Pong {
            id: new_id(),
            timestamp: timestamp(),
        }
    }

    /// Create a new MonitorListSync message
    pub fn monitor_list_sync(monitors: Vec<VirtualMonitor>) -> Self {
        Message::MonitorListSync {
            id: new_id(),
            timestamp: timestamp(),
            payload: MonitorListSyncPayload { monitors },
        }
    }

    /// Create a new MonitorAdded message
    pub fn monitor_added(monitor: VirtualMonitor) -> Self {
        Message::MonitorAdded {
            id: new_id(),
            timestamp: timestamp(),
            payload: MonitorAddedPayload { monitor },
        }
    }

    /// Create a new MonitorRemoved message
    pub fn monitor_removed(monitor_id: String) -> Self {
        Message::MonitorRemoved {
            id: new_id(),
            timestamp: timestamp(),
            payload: MonitorRemovedPayload { monitor_id },
        }
    }

    /// Create a new MonitorUpdated message
    pub fn monitor_updated(monitor: VirtualMonitor) -> Self {
        Message::MonitorUpdated {
            id: new_id(),
            timestamp: timestamp(),
            payload: MonitorUpdatedPayload { monitor },
        }
    }

    /// Create a new FlashCommand message
    pub fn flash_command(target_monitor_ids: Vec<String>) -> Self {
        Message::FlashCommand {
            id: new_id(),
            timestamp: timestamp(),
            payload: FlashCommandPayload { target_monitor_ids },
        }
    }

    /// Create a new ClearCommand message
    pub fn clear_command(target_monitor_ids: Vec<String>) -> Self {
        Message::ClearCommand {
            id: new_id(),
            timestamp: timestamp(),
            payload: ClearCommandPayload { target_monitor_ids },
        }
    }

    /// Get the message ID
    pub fn id(&self) -> &str {
        match self {
            Message::ClientHello { id, .. } => id,
            Message::ServerWelcome { id, .. } => id,
            Message::KanpeMessage { id, .. } => id,
            Message::FeedbackMessage { id, .. } => id,
            Message::Ping { id, .. } => id,
            Message::Pong { id, .. } => id,
            Message::MonitorListSync { id, .. } => id,
            Message::MonitorAdded { id, .. } => id,
            Message::MonitorRemoved { id, .. } => id,
            Message::MonitorUpdated { id, .. } => id,
            Message::FlashCommand { id, .. } => id,
            Message::ClearCommand { id, .. } => id,
        }
    }

    /// Get the message timestamp
    pub fn timestamp(&self) -> i64 {
        match self {
            Message::ClientHello { timestamp, .. } => *timestamp,
            Message::ServerWelcome { timestamp, .. } => *timestamp,
            Message::KanpeMessage { timestamp, .. } => *timestamp,
            Message::FeedbackMessage { timestamp, .. } => *timestamp,
            Message::Ping { timestamp, .. } => *timestamp,
            Message::Pong { timestamp, .. } => *timestamp,
            Message::MonitorListSync { timestamp, .. } => *timestamp,
            Message::MonitorAdded { timestamp, .. } => *timestamp,
            Message::MonitorRemoved { timestamp, .. } => *timestamp,
            Message::MonitorUpdated { timestamp, .. } => *timestamp,
            Message::FlashCommand { timestamp, .. } => *timestamp,
            Message::ClearCommand { timestamp, .. } => *timestamp,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_hello_serialization() {
        let msg = Message::client_hello("TestClient".to_string(), vec![1, 2]);
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("\"type\":\"client_hello\""));
        assert!(json.contains("\"client_name\":\"TestClient\""));
        assert!(json.contains("\"display_monitor_ids\":[1,2]"));
    }

    #[test]
    fn test_server_welcome_serialization() {
        let msg = Message::server_welcome("TestServer".to_string(), "client-123".to_string());
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("\"type\":\"server_welcome\""));
        assert!(json.contains("\"server_name\":\"TestServer\""));
        assert!(json.contains("\"assigned_client_id\":\"client-123\""));
    }

    #[test]
    fn test_kanpe_message_serialization() {
        let msg = Message::kanpe_message(
            "Test message".to_string(),
            vec![1],
            Priority::High,
        );
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("\"type\":\"kanpe_message\""));
        assert!(json.contains("\"content\":\"Test message\""));
        assert!(json.contains("\"target_monitor_ids\":[1]"));
        assert!(json.contains("\"priority\":\"high\""));
    }

    #[test]
    fn test_feedback_message_serialization() {
        let msg = Message::feedback_message(
            "Got it".to_string(),
            "TestClient".to_string(),
            "msg-123".to_string(),
            FeedbackType::Ack,
        );
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("\"type\":\"feedback_message\""));
        assert!(json.contains("\"content\":\"Got it\""));
        assert!(json.contains("\"client_name\":\"TestClient\""));
        assert!(json.contains("\"reply_to_message_id\":\"msg-123\""));
        assert!(json.contains("\"feedback_type\":\"ack\""));
    }

    #[test]
    fn test_ping_pong_serialization() {
        let ping = Message::ping();
        let json = serde_json::to_string(&ping).unwrap();
        assert!(json.contains("\"type\":\"ping\""));

        let pong = Message::pong();
        let json = serde_json::to_string(&pong).unwrap();
        assert!(json.contains("\"type\":\"pong\""));
    }

    #[test]
    fn test_message_roundtrip() {
        let original = Message::kanpe_message(
            "Test".to_string(),
            vec![0],
            Priority::Normal,
        );
        let json = serde_json::to_string(&original).unwrap();
        let deserialized: Message = serde_json::from_str(&json).unwrap();

        assert_eq!(original.id(), deserialized.id());
        assert_eq!(original.timestamp(), deserialized.timestamp());
    }

    #[test]
    fn test_message_accessors() {
        let msg = Message::ping();
        assert!(!msg.id().is_empty());
        assert!(msg.timestamp() > 0);
    }

    #[test]
    fn test_flash_command_serialization() {
        let msg = Message::flash_command(vec![1, 2]);
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("\"type\":\"flash_command\""));
        assert!(json.contains("\"target_monitor_ids\":[1,2]"));
    }

    #[test]
    fn test_clear_command_serialization() {
        let msg = Message::clear_command(vec![0]);
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("\"type\":\"clear_command\""));
        assert!(json.contains("\"target_monitor_ids\":[0]"));
    }
}
