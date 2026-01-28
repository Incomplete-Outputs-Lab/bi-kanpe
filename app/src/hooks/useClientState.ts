import { useEffect, useState, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { Message, VirtualMonitor } from "../types/messages";

export interface ClientState {
  isConnected: boolean;
  serverAddress: string | null;
  serverName: string | null;
  messages: Message[];
  availableMonitors: VirtualMonitor[];
  flashTrigger: number;
  clearTrigger: number;
  disconnectReason: string | null;
}

export function useClientState(displayMonitorIds: string[] = []) {
  // Stabilize displayMonitorIds with a string key to avoid effect re-runs on array reference changes
  const monitorIdKey = useMemo(() => displayMonitorIds.join(','), [displayMonitorIds.join(',')]);
  const stableMonitorIds = useMemo(() => displayMonitorIds, [monitorIdKey]);

  const [state, setState] = useState<ClientState>({
    isConnected: false,
    serverAddress: null,
    serverName: null,
    messages: [],
    availableMonitors: [],
    flashTrigger: 0,
    clearTrigger: 0,
    disconnectReason: null,
  });

  // Check initial connection status (important for popout windows)
  useEffect(() => {
    const checkInitialConnection = async () => {
      try {
        const isConnected = await invoke<boolean>("get_client_connection_status");
        if (isConnected) {
          setState((prev) => ({
            ...prev,
            isConnected: true,
          }));
        }
      } catch (err) {
        console.error("Failed to check initial connection status:", err);
      }
    };

    checkInitialConnection();
  }, []);

  useEffect(() => {
    // Listen for connection_established event
    const unlistenConnected = listen<{ server_address: string }>(
      "connection_established",
      (event) => {
        setState((prev) => ({
          ...prev,
          isConnected: true,
          serverAddress: event.payload.server_address,
          disconnectReason: null, // Clear any previous disconnect reason
        }));
      }
    );

    // Listen for connection_lost event
    const unlistenDisconnected = listen<{ reason: string }>(
      "connection_lost",
      (event) => {
        console.log("Connection lost:", event.payload.reason);
        setState((prev) => ({
          ...prev,
          isConnected: false,
          serverAddress: null,
          serverName: null,
          disconnectReason: event.payload.reason,
        }));
      }
    );

    // Listen for server_welcome_received event
    const unlistenWelcome = listen<{ server_name: string }>(
      "server_welcome_received",
      (event) => {
        setState((prev) => ({
          ...prev,
          serverName: event.payload.server_name,
        }));
      }
    );

    // Listen for kanpe_message_received event
    const unlistenMessage = listen<Message>(
      "kanpe_message_received",
      (event) => {
        // Filter messages based on display_monitor_ids
        const message = event.payload;
        if (message.type === "kanpe_message") {
          const targetIds = message.payload.target_monitor_ids;
          const shouldDisplay =
            targetIds.includes("ALL") || // "ALL" means all monitors
            stableMonitorIds.some((id) => targetIds.includes(id));

          if (shouldDisplay) {
            setState((prev) => ({
              ...prev,
              messages: [...prev.messages, message],
              // Trigger flash for urgent messages
              flashTrigger: message.payload.priority === "urgent" ? prev.flashTrigger + 1 : prev.flashTrigger,
            }));
          }
        }
      }
    );

    // Listen for monitor_list_received event
    const unlistenMonitorList = listen<VirtualMonitor[]>(
      "monitor_list_received",
      (event) => {
        setState((prev) => ({
          ...prev,
          availableMonitors: event.payload,
        }));
      }
    );

    // Listen for monitor_added event
    const unlistenMonitorAdded = listen<VirtualMonitor>(
      "monitor_added",
      (event) => {
        setState((prev) => ({
          ...prev,
          availableMonitors: [...prev.availableMonitors, event.payload],
        }));
      }
    );

    // Listen for monitor_removed event
    const unlistenMonitorRemoved = listen<{ monitor_id: string }>(
      "monitor_removed",
      (event) => {
        setState((prev) => ({
          ...prev,
          availableMonitors: prev.availableMonitors.filter(
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
          availableMonitors: prev.availableMonitors.map((m) =>
            m.id === event.payload.id ? event.payload : m
          ),
        }));
      }
    );

    // Listen for flash_received event
    const unlistenFlash = listen<{ target_monitor_ids: string[] }>(
      "flash_received",
      (event) => {
        const targetIds = event.payload.target_monitor_ids;
        const shouldFlash =
          targetIds.includes("ALL") || // "ALL" means all monitors
          stableMonitorIds.some((id) => targetIds.includes(id));

        if (shouldFlash) {
          setState((prev) => ({
            ...prev,
            flashTrigger: prev.flashTrigger + 1,
          }));
        }
      }
    );

    // Listen for clear_received event
    const unlistenClear = listen<{ target_monitor_ids: string[] }>(
      "clear_received",
      (event) => {
        const targetIds = event.payload.target_monitor_ids;
        const shouldClear =
          targetIds.includes("ALL") || // "ALL" means all monitors
          stableMonitorIds.some((id) => targetIds.includes(id));

        if (shouldClear) {
          setState((prev) => ({
            ...prev,
            messages: [],
            clearTrigger: prev.clearTrigger + 1,
          }));
        }
      }
    );

    // Cleanup listeners on unmount (parallel for optimal performance)
    return () => {
      Promise.all([
        unlistenConnected,
        unlistenDisconnected,
        unlistenWelcome,
        unlistenMessage,
        unlistenMonitorList,
        unlistenMonitorAdded,
        unlistenMonitorRemoved,
        unlistenMonitorUpdated,
        unlistenFlash,
        unlistenClear,
      ]).then((unlisteners) => {
        unlisteners.forEach((fn) => fn());
      });
    };
  }, [monitorIdKey, stableMonitorIds]);

  return state;
}
