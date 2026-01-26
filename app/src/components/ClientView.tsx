import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useClientState } from "../hooks/useClientState";
import type { FeedbackType, Message } from "../types/messages";

export function ClientView() {
  const [serverAddress, setServerAddress] = useState<string>("localhost:9876");
  const [clientName, setClientName] = useState<string>("Performer 1");
  const [displayMonitorIds, setDisplayMonitorIds] = useState<number[]>([1]);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonitorId, setSelectedMonitorId] = useState<number>(1);
  const [availableMonitorIds] = useState<number[]>([1, 2, 3, 4]);
  const [showConnectionPanel, setShowConnectionPanel] = useState<boolean>(true);

  const clientState = useClientState(displayMonitorIds);

  // Get the most recent message
  const currentMessage = clientState.messages[clientState.messages.length - 1];

  const handleConnect = async () => {
    if (displayMonitorIds.length === 0) {
      setError("Please select at least one monitor ID");
      return;
    }

    try {
      setError(null);
      await invoke("connect_to_server", {
        serverAddress,
        clientName,
        displayMonitorIds,
      });
      setShowConnectionPanel(false);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleDisconnect = async () => {
    try {
      setError(null);
      await invoke("disconnect_from_server");
      setShowConnectionPanel(true);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleSendFeedback = async (
    content: string,
    feedbackType: FeedbackType
  ) => {
    try {
      setError(null);
      await invoke("send_feedback", {
        content,
        sourceMonitorId: selectedMonitorId,
        replyToMessageId: currentMessage?.id || null,
        feedbackType,
      });
    } catch (err) {
      setError(String(err));
    }
  };

  const toggleMonitorId = (id: number) => {
    setDisplayMonitorIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((i) => i !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "#ff0000";
      case "high":
        return "#ff8800";
      default:
        return "#333";
    }
  };

  const getPriorityBackgroundColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "#ffcccc";
      case "high":
        return "#ffeecc";
      default:
        return "#f9f9f9";
    }
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Connection Panel */}
      {showConnectionPanel && (
        <div
          style={{
            padding: "1rem",
            borderBottom: "1px solid #ccc",
            backgroundColor: "#f5f5f5",
          }}
        >
          <h2>Performer Mode (Client)</h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              maxWidth: "600px",
            }}
          >
            <div>
              <label>Server Address:</label>
              <input
                type="text"
                value={serverAddress}
                onChange={(e) => setServerAddress(e.target.value)}
                placeholder="localhost:9876"
                style={{ marginLeft: "0.5rem", width: "300px" }}
                disabled={clientState.isConnected}
              />
            </div>

            <div>
              <label>Client Name:</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Performer 1"
                style={{ marginLeft: "0.5rem", width: "300px" }}
                disabled={clientState.isConnected}
              />
            </div>

            <div>
              <label>Display Monitor IDs:</label>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  marginLeft: "0.5rem",
                }}
              >
                {availableMonitorIds.map((id) => (
                  <label
                    key={id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={displayMonitorIds.includes(id)}
                      onChange={() => toggleMonitorId(id)}
                      disabled={clientState.isConnected}
                    />
                    ID {id}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label>Feedback Source Monitor:</label>
              <select
                value={selectedMonitorId}
                onChange={(e) => setSelectedMonitorId(Number(e.target.value))}
                style={{ marginLeft: "0.5rem" }}
              >
                {displayMonitorIds.map((id) => (
                  <option key={id} value={id}>
                    Monitor {id}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: "0.5rem" }}>
              {!clientState.isConnected ? (
                <button onClick={handleConnect}>Connect to Server</button>
              ) : (
                <div>
                  <span style={{ color: "green", marginRight: "1rem" }}>
                    Connected to {clientState.serverAddress}
                  </span>
                  <button onClick={handleDisconnect}>Disconnect</button>
                  <button
                    onClick={() => setShowConnectionPanel(false)}
                    style={{ marginLeft: "0.5rem" }}
                  >
                    Hide Panel
                  </button>
                </div>
              )}
            </div>

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
        </div>
      )}

      {/* Fullscreen Message Display */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: currentMessage
            ? getPriorityBackgroundColor(
                (currentMessage as any).payload?.priority || "normal"
              )
            : "#fff",
          position: "relative",
        }}
      >
        {!clientState.isConnected ? (
          <div style={{ textAlign: "center", color: "#999" }}>
            <p style={{ fontSize: "1.5rem" }}>Not connected to server</p>
            <p>Please connect to start receiving messages</p>
          </div>
        ) : currentMessage && currentMessage.type === "kanpe_message" ? (
          <div
            style={{
              textAlign: "center",
              padding: "2rem",
              maxWidth: "80%",
            }}
          >
            <div
              style={{
                fontSize: "3rem",
                fontWeight: "bold",
                color: getPriorityColor(currentMessage.payload.priority),
                marginBottom: "1rem",
                whiteSpace: "pre-wrap",
              }}
            >
              {currentMessage.payload.content}
            </div>
            <div
              style={{
                fontSize: "1rem",
                color: "#666",
              }}
            >
              Priority: {currentMessage.payload.priority.toUpperCase()}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", color: "#999" }}>
            <p style={{ fontSize: "1.5rem" }}>Waiting for messages...</p>
            <p>Connected to {clientState.serverName || "server"}</p>
          </div>
        )}

        {/* Show/Hide Connection Panel Toggle (when connected) */}
        {!showConnectionPanel && clientState.isConnected && (
          <button
            onClick={() => setShowConnectionPanel(true)}
            style={{
              position: "absolute",
              top: "1rem",
              right: "1rem",
              padding: "0.5rem 1rem",
            }}
          >
            Show Connection Panel
          </button>
        )}
      </div>

      {/* Feedback Buttons */}
      {clientState.isConnected && (
        <div
          style={{
            padding: "1rem",
            borderTop: "1px solid #ccc",
            display: "flex",
            gap: "0.5rem",
            justifyContent: "center",
            backgroundColor: "#f5f5f5",
          }}
        >
          <button
            onClick={() => handleSendFeedback("Acknowledged", "ack")}
            style={{ padding: "0.75rem 1.5rem", fontSize: "1rem" }}
          >
            ✓ Acknowledge
          </button>
          <button
            onClick={() => handleSendFeedback("Question", "question")}
            style={{ padding: "0.75rem 1.5rem", fontSize: "1rem" }}
          >
            ? Question
          </button>
          <button
            onClick={() => handleSendFeedback("Issue reported", "issue")}
            style={{ padding: "0.75rem 1.5rem", fontSize: "1rem" }}
          >
            ⚠ Issue
          </button>
          <button
            onClick={() => handleSendFeedback("Information", "info")}
            style={{ padding: "0.75rem 1.5rem", fontSize: "1rem" }}
          >
            ℹ Info
          </button>
        </div>
      )}
    </div>
  );
}
