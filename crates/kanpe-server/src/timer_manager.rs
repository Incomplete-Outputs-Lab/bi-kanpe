//! Timer management for director-managed timers

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use kanpe_core::{
    TimerCommandKind,
    TimerDefinition,
    TimerRuntimeState,
    TimerState,
    TimerEntry,
    TimerStateSnapshot,
};
use kanpe_core::types::timestamp;

/// Internal representation of a timer (definition + runtime)
#[derive(Clone)]
pub struct TimerInfo {
    pub definition: TimerDefinition,
    pub runtime: TimerRuntimeState,
}

/// Manages all timers on the server
#[derive(Clone, Default)]
pub struct TimerManager {
    timers: Arc<RwLock<HashMap<String, TimerInfo>>>,
}

impl TimerManager {
    /// Create a new TimerManager
    pub fn new() -> Self {
        Self {
            timers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Apply a timer command at the given timestamp
    pub async fn apply_command(
        &self,
        command: TimerCommandKind,
        now_ms: i64,
    ) -> Result<(), String> {
        let mut timers = self.timers.write().await;

        match command {
            TimerCommandKind::Create { definition } => {
                if timers.contains_key(&definition.id) {
                    return Err(format!("Timer with id {} already exists", definition.id));
                }

                let (initial_remaining, state) = if let Some(target_end) = definition.target_end_timestamp_ms {
                    let remaining = (target_end - now_ms).max(0) as u64;
                    if remaining == 0 {
                        (0u64, TimerState::Completed)
                    } else {
                        (remaining, TimerState::Pending)
                    }
                } else {
                    (definition.duration_ms, TimerState::Pending)
                };

                let runtime = TimerRuntimeState {
                    id: definition.id.clone(),
                    state,
                    started_at_timestamp_ms: None,
                    paused_at_timestamp_ms: None,
                    remaining_ms: initial_remaining,
                    last_updated_timestamp_ms: now_ms,
                };

                timers.insert(
                    definition.id.clone(),
                    TimerInfo { definition, runtime },
                );
                Ok(())
            }
            TimerCommandKind::Update { definition } => {
                let id = definition.id.clone();
                if let Some(info) = timers.get_mut(&id) {
                    info.definition = definition.clone();
                    if let Some(target_end) = definition.target_end_timestamp_ms {
                        let remaining = (target_end - now_ms).max(0) as u64;
                        info.runtime.remaining_ms = remaining;
                        if remaining == 0 && info.runtime.state == TimerState::Running {
                            info.runtime.state = TimerState::Completed;
                        }
                    } else if info.runtime.remaining_ms > info.definition.duration_ms {
                        info.runtime.remaining_ms = info.definition.duration_ms;
                    }
                    Ok(())
                } else {
                    Err(format!("Timer with id {} not found", id))
                }
            }
            TimerCommandKind::Delete { timer_id } => {
                if timers.remove(&timer_id).is_some() {
                    Ok(())
                } else {
                    Err(format!("Timer with id {} not found", timer_id))
                }
            }
            TimerCommandKind::Start { timer_id } => {
                Self::start_timer_internal(&mut timers, &timer_id, now_ms)
            }
            TimerCommandKind::Pause { timer_id } => {
                Self::pause_timer_internal(&mut timers, &timer_id, now_ms)
            }
            TimerCommandKind::Resume { timer_id } => {
                Self::resume_timer_internal(&mut timers, &timer_id, now_ms)
            }
            TimerCommandKind::Stop { timer_id, cancelled } => {
                Self::stop_timer_internal(&mut timers, &timer_id, now_ms, cancelled)
            }
        }
    }

    /// Advance timers based on current time and return a snapshot if anything changed.
    pub async fn tick_and_snapshot(&self) -> Option<TimerStateSnapshot> {
        let now_ms = timestamp();
        let mut timers = self.timers.write().await;

        let mut changed = false;

        for info in timers.values_mut() {
            match info.runtime.state {
                TimerState::Pending => {
                    if let Some(scheduled) = info.definition.scheduled_start_timestamp_ms {
                        if now_ms >= scheduled && info.runtime.remaining_ms > 0 {
                            info.runtime.state = TimerState::Running;
                            info.runtime.started_at_timestamp_ms = Some(now_ms);
                            info.runtime.paused_at_timestamp_ms = None;
                            info.runtime.last_updated_timestamp_ms = now_ms;
                            changed = true;
                        }
                    }
                }
                TimerState::Running => {
                    if let Some(target_end) = info.definition.target_end_timestamp_ms {
                        let remaining = (target_end - now_ms).max(0) as u64;
                        let prev = info.runtime.remaining_ms;
                        info.runtime.remaining_ms = remaining;
                        info.runtime.last_updated_timestamp_ms = now_ms;
                        if remaining == 0 {
                            info.runtime.state = TimerState::Completed;
                            info.runtime.started_at_timestamp_ms = None;
                            info.runtime.paused_at_timestamp_ms = None;
                        }
                        if prev != remaining {
                            changed = true;
                        }
                    } else {
                        let elapsed = now_ms.saturating_sub(info.runtime.last_updated_timestamp_ms);
                        if elapsed > 0 {
                            let elapsed_u64 = elapsed as u64;
                            if elapsed_u64 >= info.runtime.remaining_ms {
                                info.runtime.remaining_ms = 0;
                                info.runtime.state = TimerState::Completed;
                                info.runtime.started_at_timestamp_ms = None;
                                info.runtime.paused_at_timestamp_ms = None;
                                info.runtime.last_updated_timestamp_ms = now_ms;
                            } else {
                                info.runtime.remaining_ms -= elapsed_u64;
                                info.runtime.last_updated_timestamp_ms = now_ms;
                            }
                            changed = true;
                        }
                    }
                }
                TimerState::Paused | TimerState::Completed | TimerState::Cancelled => {
                    // No automatic progression
                }
            }
        }

        if changed {
            Some(Self::build_snapshot_locked(now_ms, &timers))
        } else {
            None
        }
    }

    /// Get a snapshot of all timers without advancing them
    pub async fn snapshot(&self) -> TimerStateSnapshot {
        let now_ms = timestamp();
        let timers = self.timers.read().await;
        Self::build_snapshot_locked(now_ms, &timers)
    }

    fn build_snapshot_locked(
        now_ms: i64,
        timers: &HashMap<String, TimerInfo>,
    ) -> TimerStateSnapshot {
        let entries: Vec<TimerEntry> = timers
            .values()
            .cloned()
            .map(|info| TimerEntry {
                definition: info.definition,
                runtime: info.runtime,
            })
            .collect();

        TimerStateSnapshot {
            timestamp_ms: now_ms,
            timers: entries,
        }
    }

    fn start_timer_internal(
        timers: &mut HashMap<String, TimerInfo>,
        timer_id: &str,
        now_ms: i64,
    ) -> Result<(), String> {
        let info = timers
            .get_mut(timer_id)
            .ok_or_else(|| format!("Timer with id {} not found", timer_id))?;

        match info.runtime.state {
            TimerState::Pending | TimerState::Paused | TimerState::Completed | TimerState::Cancelled => {
                if info.runtime.remaining_ms == 0 {
                    if let Some(target_end) = info.definition.target_end_timestamp_ms {
                        info.runtime.remaining_ms = (target_end - now_ms).max(0) as u64;
                    } else {
                        info.runtime.remaining_ms = info.definition.duration_ms;
                    }
                }
                info.runtime.state = TimerState::Running;
                info.runtime.started_at_timestamp_ms = Some(now_ms);
                info.runtime.paused_at_timestamp_ms = None;
                info.runtime.last_updated_timestamp_ms = now_ms;
                Ok(())
            }
            TimerState::Running => Err("Timer is already running".to_string()),
        }
    }

    fn pause_timer_internal(
        timers: &mut HashMap<String, TimerInfo>,
        timer_id: &str,
        now_ms: i64,
    ) -> Result<(), String> {
        let info = timers
            .get_mut(timer_id)
            .ok_or_else(|| format!("Timer with id {} not found", timer_id))?;

        if let TimerState::Running = info.runtime.state {
            let elapsed = now_ms.saturating_sub(info.runtime.last_updated_timestamp_ms);
            if elapsed > 0 {
                let elapsed_u64 = elapsed as u64;
                if elapsed_u64 >= info.runtime.remaining_ms {
                    info.runtime.remaining_ms = 0;
                } else {
                    info.runtime.remaining_ms -= elapsed_u64;
                }
            }
            info.runtime.state = TimerState::Paused;
            info.runtime.started_at_timestamp_ms = None;
            info.runtime.paused_at_timestamp_ms = Some(now_ms);
            info.runtime.last_updated_timestamp_ms = now_ms;
            Ok(())
        } else {
            Err("Timer is not running".to_string())
        }
    }

    fn resume_timer_internal(
        timers: &mut HashMap<String, TimerInfo>,
        timer_id: &str,
        now_ms: i64,
    ) -> Result<(), String> {
        let info = timers
            .get_mut(timer_id)
            .ok_or_else(|| format!("Timer with id {} not found", timer_id))?;

        if let TimerState::Paused = info.runtime.state {
            if info.runtime.remaining_ms == 0 {
                if let Some(target_end) = info.definition.target_end_timestamp_ms {
                    info.runtime.remaining_ms = (target_end - now_ms).max(0) as u64;
                } else {
                    info.runtime.remaining_ms = info.definition.duration_ms;
                }
            }
            info.runtime.state = TimerState::Running;
            info.runtime.started_at_timestamp_ms = Some(now_ms);
            info.runtime.paused_at_timestamp_ms = None;
            info.runtime.last_updated_timestamp_ms = now_ms;
            Ok(())
        } else {
            Err("Timer is not paused".to_string())
        }
    }

    fn stop_timer_internal(
        timers: &mut HashMap<String, TimerInfo>,
        timer_id: &str,
        now_ms: i64,
        cancelled: bool,
    ) -> Result<(), String> {
        let info = timers
            .get_mut(timer_id)
            .ok_or_else(|| format!("Timer with id {} not found", timer_id))?;

        // If running, first update remaining time based on elapsed
        if let TimerState::Running = info.runtime.state {
            let elapsed = now_ms.saturating_sub(info.runtime.last_updated_timestamp_ms);
            if elapsed > 0 {
                let elapsed_u64 = elapsed as u64;
                if elapsed_u64 >= info.runtime.remaining_ms {
                    info.runtime.remaining_ms = 0;
                } else {
                    info.runtime.remaining_ms -= elapsed_u64;
                }
            }
        }

        info.runtime.state = if cancelled {
            TimerState::Cancelled
        } else {
            TimerState::Completed
        };
        info.runtime.remaining_ms = 0;
        info.runtime.started_at_timestamp_ms = None;
        info.runtime.paused_at_timestamp_ms = None;
        info.runtime.last_updated_timestamp_ms = now_ms;

        Ok(())
    }
}

