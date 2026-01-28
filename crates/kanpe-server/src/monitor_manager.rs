//! Monitor management for virtual monitors

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use kanpe_core::types::VirtualMonitor;

/// Manages virtual monitors for the server
#[derive(Clone)]
pub struct MonitorManager {
    monitors: Arc<RwLock<HashMap<String, VirtualMonitor>>>,
}

impl MonitorManager {
    /// Create a new MonitorManager
    pub fn new() -> Self {
        Self {
            monitors: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Initialize with default monitors (A, B, C, D)
    pub async fn initialize_default_monitors(&self) {
        self.add_monitor_with_id("A".to_string(), "Monitor A".to_string(), Some("モニター A".to_string()), Some("#3b82f6".to_string())).await;
        self.add_monitor_with_id("B".to_string(), "Monitor B".to_string(), Some("モニター B".to_string()), Some("#10b981".to_string())).await;
        self.add_monitor_with_id("C".to_string(), "Monitor C".to_string(), Some("モニター C".to_string()), Some("#f59e0b".to_string())).await;
        self.add_monitor_with_id("D".to_string(), "Monitor D".to_string(), Some("モニター D".to_string()), Some("#ef4444".to_string())).await;
    }

    /// Add a new monitor with auto-generated ID
    pub async fn add_monitor(
        &self,
        name: String,
        description: Option<String>,
        color: Option<String>,
    ) -> VirtualMonitor {
        // Generate a new unique ID (use timestamp-based or UUID-based approach)
        let id = self.generate_new_id().await;
        self.add_monitor_with_id(id, name, description, color).await
    }

    /// Add a new monitor with a specific ID
    pub async fn add_monitor_with_id(
        &self,
        id: String,
        name: String,
        description: Option<String>,
        color: Option<String>,
    ) -> VirtualMonitor {
        let monitor = VirtualMonitor {
            id: id.clone(),
            name,
            description,
            color,
        };

        let mut monitors = self.monitors.write().await;
        monitors.insert(id, monitor.clone());
        drop(monitors);

        monitor
    }

    /// Generate a new unique ID for a monitor
    async fn generate_new_id(&self) -> String {
        let monitors = self.monitors.read().await;
        let mut counter = 1;
        loop {
            let id = format!("M{}", counter);
            if !monitors.contains_key(&id) {
                return id;
            }
            counter += 1;
        }
    }

    /// Remove a monitor by ID
    pub async fn remove_monitor(&self, id: String) -> Option<VirtualMonitor> {
        let mut monitors = self.monitors.write().await;
        monitors.remove(&id)
    }

    /// Update an existing monitor
    pub async fn update_monitor(&self, monitor: VirtualMonitor) -> bool {
        let mut monitors = self.monitors.write().await;
        if monitors.contains_key(&monitor.id) {
            monitors.insert(monitor.id.clone(), monitor);
            true
        } else {
            false
        }
    }

    /// Get all monitors, sorted by ID for consistent ordering
    pub async fn get_all_monitors(&self) -> Vec<VirtualMonitor> {
        let monitors = self.monitors.read().await;
        let mut monitor_list: Vec<VirtualMonitor> = monitors.values().cloned().collect();
        // Sort by ID to ensure consistent ordering (A, B, C, D, etc.)
        monitor_list.sort_by(|a, b| a.id.cmp(&b.id));
        monitor_list
    }

    /// Get a specific monitor by ID
    pub async fn get_monitor(&self, id: String) -> Option<VirtualMonitor> {
        let monitors = self.monitors.read().await;
        monitors.get(&id).cloned()
    }
}

impl Default for MonitorManager {
    fn default() -> Self {
        Self::new()
    }
}
