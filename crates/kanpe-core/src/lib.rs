//! Kanpe Core - Protocol definitions and shared types
//!
//! This crate contains the core message protocol and types used by both
//! the kanpe-server and kanpe-client crates.

pub mod message;
pub mod types;

// Re-export commonly used types
pub use message::Message;
pub use types::{Priority, FeedbackType};
