import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { ConnectedClientInfo, Message } from "../types/messages";

export interface ServerState {
  isRunning: boolean;
  port: number | null;
  clients: ConnectedClientInfo[];
  feedbackMessages: Message[];
}

export function useServerState() {
  const [state, setState] = useState<ServerState>({
    isRunning: false,
    port: null,
    clients: [],
    feedbackMessages: [],
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

    // Cleanup listeners on unmount
    return () => {
      unlistenServerStarted.then((fn) => fn());
      unlistenClientConnected.then((fn) => fn());
      unlistenClientDisconnected.then((fn) => fn());
      unlistenFeedback.then((fn) => fn());
    };
  }, []);

  return state;
}
