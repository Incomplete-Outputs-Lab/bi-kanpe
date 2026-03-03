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

/// Virtual monitor definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VirtualMonitor {
    /// Unique monitor ID (e.g., "A", "B", "C", "D")
    pub id: String,
    /// Display name for the monitor
    pub name: String,
    /// Optional description
    pub description: Option<String>,
    /// Optional color in hex format (e.g., "#FF5733")
    pub color: Option<String>,
}

/// Timer state for director-managed timers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TimerState {
    /// Timer is defined but not started yet (may have a scheduled start time)
    Pending,
    /// Timer is currently counting down
    Running,
    /// Timer is paused
    Paused,
    /// Timer has completed normally
    Completed,
    /// Timer was cancelled by the director
    Cancelled,
}

/// Static definition of a timer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimerDefinition {
    /// Unique timer ID (UUID string)
    pub id: String,
    /// Human-readable name (e.g., "Opening", "Segment A")
    pub name: String,
    /// Target virtual monitor IDs this timer is relevant for (e.g., ["A", "B"] or ["ALL"])
    pub target_monitor_ids: Vec<String>,
    /// Total duration of the timer in milliseconds (used when target_end_timestamp_ms is None)
    pub duration_ms: u64,
    /// Optional scheduled start time (Unix timestamp in milliseconds, server clock)
    pub scheduled_start_timestamp_ms: Option<i64>,
    /// Optional target end time: count down until this moment (Unix timestamp in milliseconds, server clock).
    /// When set, remaining_ms is computed as max(0, target_end_timestamp_ms - now) instead of duration-based countdown.
    pub target_end_timestamp_ms: Option<i64>,
}

/// Runtime state for a timer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimerRuntimeState {
    /// ID of the timer (must match TimerDefinition.id)
    pub id: String,
    /// Current state of the timer
    pub state: TimerState,
    /// Timestamp when the timer was last started (Unix ms, server clock)
    pub started_at_timestamp_ms: Option<i64>,
    /// Timestamp when the timer was last paused (Unix ms, server clock)
    pub paused_at_timestamp_ms: Option<i64>,
    /// Remaining time in milliseconds (server-calculated)
    pub remaining_ms: u64,
    /// Last timestamp when remaining_ms was updated (Unix ms, server clock)
    pub last_updated_timestamp_ms: i64,
}

/// Single timer entry in a snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimerEntry {
    /// Static definition of the timer
    pub definition: TimerDefinition,
    /// Current runtime state of the timer
    pub runtime: TimerRuntimeState,
}

/// Snapshot of all timers for synchronization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimerStateSnapshot {
    /// Server timestamp when this snapshot was generated
    pub timestamp_ms: i64,
    /// All known timers with their definitions and runtime state
    pub timers: Vec<TimerEntry>,
}

/// Commands that can be issued for timers
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum TimerCommandKind {
    /// Create a new timer
    Create {
        definition: TimerDefinition,
    },
    /// Update an existing timer's definition (name, targets, duration, schedule)
    Update {
        definition: TimerDefinition,
    },
    /// Delete a timer
    Delete {
        timer_id: String,
    },
    /// Start a timer immediately
    Start {
        timer_id: String,
    },
    /// Pause a running timer
    Pause {
        timer_id: String,
    },
    /// Resume a paused timer
    Resume {
        timer_id: String,
    },
    /// Stop a timer and mark as completed (or cancelled)
    Stop {
        timer_id: String,
        /// If true, mark as cancelled instead of completed
        cancelled: bool,
    },
}

/// Payload for timer-related commands
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimerCommandPayload {
    /// Command to execute
    pub command: TimerCommandKind,
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
