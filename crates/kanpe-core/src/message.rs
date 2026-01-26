//! Message types for the Kanpe protocol

use serde::{Deserialize, Serialize};
use crate::types::{new_id, timestamp, Priority, FeedbackType};

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
}

/// Payload for ClientHello message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientHelloPayload {
    /// Client's display name
    pub client_name: String,
    /// Virtual monitor IDs this client is displaying
    pub display_monitor_ids: Vec<u32>,
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
    /// Target virtual monitor IDs (0 = all monitors)
    pub target_monitor_ids: Vec<u32>,
    /// Message priority
    pub priority: Priority,
}

/// Payload for FeedbackMessage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeedbackMessagePayload {
    /// Feedback content (text)
    pub content: String,
    /// Source monitor ID where feedback originated
    pub source_monitor_id: u32,
    /// Optional: ID of message being replied to
    pub reply_to_message_id: Option<String>,
    /// Type of feedback
    pub feedback_type: FeedbackType,
}

impl Message {
    /// Create a new ClientHello message
    pub fn client_hello(client_name: String, display_monitor_ids: Vec<u32>) -> Self {
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
        target_monitor_ids: Vec<u32>,
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
        source_monitor_id: u32,
        reply_to_message_id: Option<String>,
        feedback_type: FeedbackType,
    ) -> Self {
        Message::FeedbackMessage {
            id: new_id(),
            timestamp: timestamp(),
            payload: FeedbackMessagePayload {
                content,
                source_monitor_id,
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

    /// Get the message ID
    pub fn id(&self) -> &str {
        match self {
            Message::ClientHello { id, .. } => id,
            Message::ServerWelcome { id, .. } => id,
            Message::KanpeMessage { id, .. } => id,
            Message::FeedbackMessage { id, .. } => id,
            Message::Ping { id, .. } => id,
            Message::Pong { id, .. } => id,
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
            1,
            Some("msg-123".to_string()),
            FeedbackType::Ack,
        );
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("\"type\":\"feedback_message\""));
        assert!(json.contains("\"content\":\"Got it\""));
        assert!(json.contains("\"source_monitor_id\":1"));
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
}
