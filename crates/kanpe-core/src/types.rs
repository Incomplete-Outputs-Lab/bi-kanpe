//! Core types for the Kanpe protocol

use serde::{Deserialize, Serialize};

/// Priority levels for Kanpe messages
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    Normal,
    High,
    Urgent,
}

impl Default for Priority {
    fn default() -> Self {
        Priority::Normal
    }
}

/// Feedback type classification
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FeedbackType {
    Ack,        // Simple acknowledgment
    Question,   // Question for clarification
    Issue,      // Problem or concern
    Info,       // General information
}

impl Default for FeedbackType {
    fn default() -> Self {
        FeedbackType::Ack
    }
}

/// Helper function to generate a new UUID string
pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Helper function to get current Unix timestamp in milliseconds
pub fn timestamp() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_priority_serialization() {
        assert_eq!(
            serde_json::to_string(&Priority::Normal).unwrap(),
            "\"normal\""
        );
        assert_eq!(
            serde_json::to_string(&Priority::High).unwrap(),
            "\"high\""
        );
        assert_eq!(
            serde_json::to_string(&Priority::Urgent).unwrap(),
            "\"urgent\""
        );
    }

    #[test]
    fn test_feedback_type_serialization() {
        assert_eq!(
            serde_json::to_string(&FeedbackType::Ack).unwrap(),
            "\"ack\""
        );
        assert_eq!(
            serde_json::to_string(&FeedbackType::Question).unwrap(),
            "\"question\""
        );
    }

    #[test]
    fn test_new_id_generates_valid_uuid() {
        let id = new_id();
        assert!(uuid::Uuid::parse_str(&id).is_ok());
    }

    #[test]
    fn test_timestamp_is_recent() {
        let ts = timestamp();
        let now = chrono::Utc::now().timestamp_millis();
        // Should be within 1 second
        assert!((now - ts).abs() < 1000);
    }
}
