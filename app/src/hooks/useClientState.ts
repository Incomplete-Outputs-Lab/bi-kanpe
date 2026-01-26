import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { Message, VirtualMonitor } from "../types/messages";

export interface ClientState {
  isConnected: boolean;
  serverAddress: string | null;
  serverName: string | null;
  messages: Message[];
  displayMonitorIds: number[];
  availableMonitors: VirtualMonitor[];
}

export function useClientState(displayMonitorIds: number[] = []) {
  const [state, setState] = useState<ClientState>({
    isConnected: false,
    serverAddress: null,
    serverName: null,
    messages: [],
    displayMonitorIds,
    availableMonitors: [],
  });

  useEffect(() => {
    setState((prev) => ({ ...prev, displayMonitorIds }));
  }, [displayMonitorIds]);

  useEffect(() => {
    // Listen for connection_established event
    const unlistenConnected = listen<{ server_address: string }>(
      "connection_established",
      (event) => {
        setState((prev) => ({
          ...prev,
          isConnected: true,
          serverAddress: event.payload.server_address,
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
            targetIds.includes(0) || // 0 means all monitors
            displayMonitorIds.some((id) => targetIds.includes(id));

          if (shouldDisplay) {
            setState((prev) => ({
              ...prev,
              messages: [...prev.messages, message],
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
    const unlistenMonitorRemoved = listen<{ monitor_id: number }>(
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

    // Cleanup listeners on unmount
    return () => {
      unlistenConnected.then((fn) => fn());
      unlistenDisconnected.then((fn) => fn());
      unlistenWelcome.then((fn) => fn());
      unlistenMessage.then((fn) => fn());
      unlistenMonitorList.then((fn) => fn());
      unlistenMonitorAdded.then((fn) => fn());
      unlistenMonitorRemoved.then((fn) => fn());
      unlistenMonitorUpdated.then((fn) => fn());
    };
  }, [displayMonitorIds]);

  return state;
}
