import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useServerState } from "../hooks/useServerState";
import type { Priority, Message } from "../types/messages";

export function ServerView() {
  const serverState = useServerState();
  const [port, setPort] = useState<number>(9876);
  const [messageContent, setMessageContent] = useState<string>("");
  const [targetMonitorIds, setTargetMonitorIds] = useState<number[]>([0]);
  const [priority, setPriority] = useState<Priority>("normal");
  const [error, setError] = useState<string | null>(null);
  const [availableMonitorIds, setAvailableMonitorIds] = useState<number[]>([
    0, 1, 2, 3, 4,
  ]);

  const handleStartServer = async () => {
    try {
      setError(null);
      await invoke("start_server", { port });
    } catch (err) {
      setError(String(err));
    }
  };

  const handleStopServer = async () => {
    try {
      setError(null);
      await invoke("stop_server");
    } catch (err) {
      setError(String(err));
    }
  };

  const handleSendMessage = async () => {
    if (!messageContent.trim()) {
      setError("Message content cannot be empty");
      return;
    }

    try {
      setError(null);
      await invoke("send_kanpe_message", {
        targetMonitorIds,
        content: messageContent,
        priority,
      });
      setMessageContent("");
    } catch (err) {
      setError(String(err));
    }
  };

  const toggleMonitorId = (id: number) => {
    if (id === 0) {
      // If "All" is selected, clear other selections
      setTargetMonitorIds([0]);
    } else {
      setTargetMonitorIds((prev) => {
        const newIds = prev.filter((i) => i !== 0); // Remove "All" if specific ID selected
        if (newIds.includes(id)) {
          return newIds.filter((i) => i !== id);
        } else {
          return [...newIds, id];
        }
      });
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div style={{ padding: "1rem", display: "flex", gap: "1rem", height: "100vh" }}>
      {/* Left Panel - Server Controls and Message Input */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h2>Director Mode (Server)</h2>

        {/* Server Controls */}
        <div
          style={{
            border: "1px solid #ccc",
            padding: "1rem",
            borderRadius: "4px",
          }}
        >
          <h3>Server Controls</h3>
          {!serverState.isRunning ? (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <label>Port:</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                style={{ width: "100px" }}
              />
              <button onClick={handleStartServer}>Start Server</button>
            </div>
          ) : (
            <div>
              <p>
                Server running on port <strong>{serverState.port}</strong>
              </p>
              <button onClick={handleStopServer}>Stop Server</button>
            </div>
          )}
        </div>

        {/* Message Input */}
        {serverState.isRunning && (
          <div
            style={{
              border: "1px solid #ccc",
              padding: "1rem",
              borderRadius: "4px",
              flex: 1,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h3>Send Message</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1 }}>
              <label>Content:</label>
              <textarea
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                placeholder="Enter message content..."
                style={{ flex: 1, minHeight: "100px", resize: "vertical" }}
              />

              <div>
                <label>Target Monitor IDs:</label>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {availableMonitorIds.map((id) => (
                    <label key={id} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <input
                        type="checkbox"
                        checked={targetMonitorIds.includes(id)}
                        onChange={() => toggleMonitorId(id)}
                      />
                      {id === 0 ? "All" : `ID ${id}`}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label>Priority:</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  style={{ marginLeft: "0.5rem" }}
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <button onClick={handleSendMessage}>Send Message</button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div
            style={{
              padding: "0.5rem",
              backgroundColor: "#ffcccc",
              border: "1px solid #ff0000",
              borderRadius: "4px",
            }}
          >
            Error: {error}
          </div>
        )}
      </div>

      {/* Right Panel - Connected Clients and Feedback */}
      {serverState.isRunning && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Connected Clients */}
          <div
            style={{
              border: "1px solid #ccc",
              padding: "1rem",
              borderRadius: "4px",
              maxHeight: "40%",
              overflowY: "auto",
            }}
          >
            <h3>Connected Clients ({serverState.clients.length})</h3>
            {serverState.clients.length === 0 ? (
              <p>No clients connected</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0 }}>
                {serverState.clients.map((client) => (
                  <li
                    key={client.client_id}
                    style={{
                      padding: "0.5rem",
                      marginBottom: "0.5rem",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                    }}
                  >
                    <strong>{client.name}</strong>
                    <br />
                    <small>
                      Monitor IDs: {client.monitor_ids.join(", ")}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Feedback Display */}
          <div
            style={{
              border: "1px solid #ccc",
              padding: "1rem",
              borderRadius: "4px",
              flex: 1,
              overflowY: "auto",
            }}
          >
            <h3>Feedback ({serverState.feedbackMessages.length})</h3>
            {serverState.feedbackMessages.length === 0 ? (
              <p>No feedback received</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {serverState.feedbackMessages
                  .slice()
                  .reverse()
                  .map((msg) => {
                    if (msg.type === "feedback_message") {
                      return (
                        <div
                          key={msg.id}
                          style={{
                            padding: "0.5rem",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            backgroundColor: "#f9f9f9",
                          }}
                        >
                          <div style={{ marginBottom: "0.25rem" }}>
                            <strong>Monitor {msg.payload.source_monitor_id}</strong>
                            <span style={{ float: "right", fontSize: "0.8em", color: "#666" }}>
                              {formatTimestamp(msg.timestamp)}
                            </span>
                          </div>
                          <div>{msg.payload.content}</div>
                          <div style={{ fontSize: "0.8em", color: "#666", marginTop: "0.25rem" }}>
                            Type: {msg.payload.feedback_type}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
