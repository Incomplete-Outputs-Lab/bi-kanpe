import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { Message } from "../types/messages";

export interface ClientState {
  isConnected: boolean;
  serverAddress: string | null;
  serverName: string | null;
  messages: Message[];
  displayMonitorIds: number[];
}

export function useClientState(displayMonitorIds: number[] = []) {
  const [state, setState] = useState<ClientState>({
    isConnected: false,
    serverAddress: null,
    serverName: null,
    messages: [],
    displayMonitorIds,
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

    // Cleanup listeners on unmount
    return () => {
      unlistenConnected.then((fn) => fn());
      unlistenDisconnected.then((fn) => fn());
      unlistenWelcome.then((fn) => fn());
      unlistenMessage.then((fn) => fn());
    };
  }, [displayMonitorIds]);

  return state;
}
