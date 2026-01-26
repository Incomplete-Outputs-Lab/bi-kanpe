import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { ConnectedClientInfo, Message, VirtualMonitor } from "../types/messages";

export interface ServerState {
  isRunning: boolean;
  port: number | null;
  clients: ConnectedClientInfo[];
  feedbackMessages: Message[];
  monitors: VirtualMonitor[];
}

export function useServerState() {
  const [state, setState] = useState<ServerState>({
    isRunning: false,
    port: null,
    clients: [],
    feedbackMessages: [],
    monitors: [],
  });

  useEffect(() => {
    // Listen for server_started event
    const unlistenServerStarted = listen<{ port: number }>(
      "server_started",
      (event) => {
        setState((prev) => ({
          ...prev,
          isRunning: true,
          port: event.payload.port,
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
    const unlistenMonitorRemoved = listen<{ monitor_id: number }>(
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

    // Cleanup listeners on unmount
    return () => {
      unlistenServerStarted.then((fn) => fn());
      unlistenServerStopped.then((fn) => fn());
      unlistenClientConnected.then((fn) => fn());
      unlistenClientDisconnected.then((fn) => fn());
      unlistenFeedback.then((fn) => fn());
      unlistenMonitorAdded.then((fn) => fn());
      unlistenMonitorRemoved.then((fn) => fn());
      unlistenMonitorUpdated.then((fn) => fn());
    };
  }, []);

  return state;
}
