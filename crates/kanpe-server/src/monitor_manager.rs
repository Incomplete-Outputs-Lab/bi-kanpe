//! Monitor management for virtual monitors

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use kanpe_core::types::VirtualMonitor;

/// Manages virtual monitors for the server
#[derive(Clone)]
pub struct MonitorManager {
    monitors: Arc<RwLock<HashMap<u32, VirtualMonitor>>>,
    next_id: Arc<RwLock<u32>>,
}

impl MonitorManager {
    /// Create a new MonitorManager
    pub fn new() -> Self {
        Self {
            monitors: Arc::new(RwLock::new(HashMap::new())),
            next_id: Arc::new(RwLock::new(1)),
        }
    }

    /// Initialize with default monitors (4 monitors)
    pub async fn initialize_default_monitors(&self) {
        self.add_monitor("Monitor 1".to_string(), Some("First monitor".to_string()), Some("#FF5733".to_string())).await;
        self.add_monitor("Monitor 2".to_string(), Some("Second monitor".to_string()), Some("#33FF57".to_string())).await;
        self.add_monitor("Monitor 3".to_string(), Some("Third monitor".to_string()), Some("#3357FF".to_string())).await;
        self.add_monitor("Monitor 4".to_string(), Some("Fourth monitor".to_string()), Some("#FF33F5".to_string())).await;
    }

    /// Add a new monitor
    pub async fn add_monitor(
        &self,
        name: String,
        description: Option<String>,
        color: Option<String>,
    ) -> VirtualMonitor {
        let mut next_id = self.next_id.write().await;
        let id = *next_id;
        *next_id += 1;
        drop(next_id);

        let monitor = VirtualMonitor {
            id,
            name,
            description,
            color,
        };

        let mut monitors = self.monitors.write().await;
        monitors.insert(id, monitor.clone());
        drop(monitors);

        monitor
    }

    /// Remove a monitor by ID
    pub async fn remove_monitor(&self, id: u32) -> Option<VirtualMonitor> {
        let mut monitors = self.monitors.write().await;
        monitors.remove(&id)
    }

    /// Update an existing monitor
    pub async fn update_monitor(&self, monitor: VirtualMonitor) -> bool {
        let mut monitors = self.monitors.write().await;
        if monitors.contains_key(&monitor.id) {
            monitors.insert(monitor.id, monitor);
            true
        } else {
            false
        }
    }

    /// Get all monitors
    pub async fn get_all_monitors(&self) -> Vec<VirtualMonitor> {
        let monitors = self.monitors.read().await;
        monitors.values().cloned().collect()
    }

    /// Get a specific monitor by ID
    pub async fn get_monitor(&self, id: u32) -> Option<VirtualMonitor> {
        let monitors = self.monitors.read().await;
        monitors.get(&id).cloned()
    }
}

impl Default for MonitorManager {
    fn default() -> Self {
        Self::new()
    }
}
