import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type {
  ConnectedClientInfo,
  Message,
  VirtualMonitor,
  TimerStateSnapshot,
} from "../types/messages";

export interface ServerState {
  isRunning: boolean;
  port: number | null;
  clients: ConnectedClientInfo[];
  feedbackMessages: Message[];
  sentMessages: Message[];
  monitors: VirtualMonitor[];
  timers: TimerStateSnapshot | null;
}

export function useServerState() {
  const [state, setState] = useState<ServerState>({
    isRunning: false,
    port: null,
    clients: [],
    feedbackMessages: [],
    sentMessages: [],
    monitors: [],
    timers: null,
  });

  useEffect(() => {
    // Listen for server_started event
    const unlistenServerStarted = listen<{ port: number; monitors: VirtualMonitor[] }>(
      "server_started",
      (event) => {
        setState((prev) => ({
          ...prev,
          isRunning: true,
          port: event.payload.port,
          monitors: event.payload.monitors,
        }));
      }
    );

    // Listen for server_stopped event
    const unlistenServerStopped = listen("server_stopped", () => {
      setState({
        isRunning: false,
        port: null,
        clients: [],
        feedbackMessages: [],
        sentMessages: [],
        monitors: [],
      });
    });

    // Listen for client_connected event
    const unlistenClientConnected = listen<ConnectedClientInfo>(
      "client_connected",
      (event) => {
        setState((prev) => ({
          ...prev,
          clients: [...prev.clients, event.payload],
        }));
      }
    );

    // Listen for client_disconnected event
    const unlistenClientDisconnected = listen<{ client_id: string }>(
      "client_disconnected",
      (event) => {
        setState((prev) => ({
          ...prev,
          clients: prev.clients.filter(
            (c) => c.client_id !== event.payload.client_id
          ),
        }));
      }
    );

    // Listen for feedback_received event
    const unlistenFeedback = listen<Message>("feedback_received", (event) => {
      setState((prev) => ({
        ...prev,
        feedbackMessages: [...prev.feedbackMessages, event.payload],
      }));
    });

    // Listen for monitor_added event
    const unlistenMonitorAdded = listen<VirtualMonitor>(
      "monitor_added",
      (event) => {
        setState((prev) => ({
          ...prev,
          monitors: [...prev.monitors, event.payload],
        }));
      }
    );

    // Listen for monitor_removed event
    const unlistenMonitorRemoved = listen<{ monitor_id: string }>(
      "monitor_removed",
      (event) => {
        setState((prev) => ({
          ...prev,
          monitors: prev.monitors.filter(
            (m) => m.id !== event.payload.monitor_id
          ),
        }));
      }
    );

    // Listen for monitor_updated event
    const unlistenMonitorUpdated = listen<VirtualMonitor>(
      "monitor_updated",
      (event) => {
        setState((prev) => ({
          ...prev,
          monitors: prev.monitors.map((m) =>
            m.id === event.payload.id ? event.payload : m
          ),
        }));
      }
    );

    // Listen for kanpe_message_sent event
    const unlistenMessageSent = listen<Message>("kanpe_message_sent", (event) => {
      setState((prev) => ({
        ...prev,
        sentMessages: [...prev.sentMessages, event.payload],
      }));
    });

    // Cleanup listeners on unmount (parallel for optimal performance)
    return () => {
      Promise.all([
        unlistenServerStarted,
        unlistenServerStopped,
        unlistenClientConnected,
        unlistenClientDisconnected,
        unlistenFeedback,
        unlistenMonitorAdded,
        unlistenMonitorRemoved,
        unlistenMonitorUpdated,
        unlistenMessageSent,
      ]).then((unlisteners) => {
        unlisteners.forEach((fn) => fn());
      });
    };
  }, []);

  // Poll timer snapshot periodically while server is running
  useEffect(() => {
    if (!state.isRunning) {
      setState((prev) => ({ ...prev, timers: null }));
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const snapshot = await invoke<TimerStateSnapshot>("get_timer_snapshot");
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            timers: snapshot,
          }));
        }
      } catch (err) {
        console.error("Failed to get timer snapshot:", err);
      }
    };

    // Initial fetch
    poll();
    const id = window.setInterval(poll, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [state.isRunning]);

  return state;
}
