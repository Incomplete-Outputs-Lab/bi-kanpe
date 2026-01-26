import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useServerState } from "../hooks/useServerState";
import type { Priority } from "../types/messages";

interface ServerViewProps {
  onBackToMenu: () => void;
}

export function ServerView({ onBackToMenu }: ServerViewProps) {
  const serverState = useServerState();
  const [port, setPort] = useState<number>(9876);
  const [messageContent, setMessageContent] = useState<string>("");
  const [targetMonitorIds, setTargetMonitorIds] = useState<number[]>([0]);
  const [priority, setPriority] = useState<Priority>("normal");
  const [error, setError] = useState<string | null>(null);
  const [availableMonitorIds, _setAvailableMonitorIds] = useState<number[]>([
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
    <div style={{ padding: "1rem", display: "flex", gap: "1rem", height: "100vh", backgroundColor: "#f5f5f5" }}>
      {/* Left Panel - Server Controls and Message Input */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: "1.8rem", color: "#667eea" }}>
            🎬 カンペモード
          </h2>
          <button
            onClick={onBackToMenu}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.95rem",
              fontWeight: "600",
              backgroundColor: "#6b7280",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            ← メインメニューに戻る
          </button>
        </div>

        {/* Server Controls */}
        <div
          style={{
            border: "1px solid #ccc",
            padding: "1rem",
            borderRadius: "8px",
            backgroundColor: "white",
          }}
        >
          <h3 style={{ marginTop: 0, color: "#000" }}>サーバー制御</h3>
          {!serverState.isRunning ? (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ fontWeight: "600", color: "#000" }}>ポート番号:</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                style={{
                  width: "120px",
                  padding: "0.5rem",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  fontSize: "1rem",
                }}
              />
              <button
                onClick={handleStartServer}
                style={{
                  padding: "0.5rem 1.5rem",
                  fontSize: "1rem",
                  fontWeight: "600",
                  backgroundColor: "#667eea",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                🚀 サーバー起動
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <p style={{ margin: 0 }}>
                <span style={{ color: "#22c55e", fontWeight: "600", fontSize: "1.1rem" }}>
                  ● 起動中
                </span>
                {" - "}ポート <strong style={{ fontSize: "1.1rem" }}>{serverState.port}</strong>
              </p>
              <button
                onClick={handleStopServer}
                style={{
                  padding: "0.5rem 1.5rem",
                  fontSize: "1rem",
                  fontWeight: "600",
                  backgroundColor: "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  width: "fit-content",
                }}
              >
                ⏹ サーバー停止
              </button>
            </div>
          )}
        </div>

        {/* Message Input */}
        {serverState.isRunning && (
          <div
            style={{
              border: "1px solid #ccc",
              padding: "1rem",
              borderRadius: "8px",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#f9f9f9",
            }}
          >
            <h3 style={{ marginTop: 0, color: "#000" }}>メッセージ送信</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", flex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontWeight: "600", fontSize: "0.95rem", color: "#000" }}>
                  メッセージ内容:
                </label>
                <textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="キャスターに表示するメッセージを入力..."
                  style={{
                    flex: 1,
                    minHeight: "120px",
                    resize: "vertical",
                    padding: "0.75rem",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                    fontSize: "1rem",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <label style={{ fontWeight: "600", fontSize: "0.95rem", color: "#000" }}>
                    送信先モニター:
                  </label>
                  <span
                    style={{
                      fontSize: "0.85rem",
                      color: "#555",
                      fontStyle: "italic",
                    }}
                  >
                    (複数選択可)
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
                    gap: "0.5rem",
                    padding: "0.75rem",
                    backgroundColor: "white",
                    borderRadius: "4px",
                    border: "1px solid #ddd",
                  }}
                >
                  {availableMonitorIds.map((id) => (
                    <label
                      key={id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.5rem",
                        borderRadius: "4px",
                        cursor: "pointer",
                        backgroundColor: targetMonitorIds.includes(id)
                          ? "#667eea"
                          : "#f5f5f5",
                        color: targetMonitorIds.includes(id) ? "white" : "#333",
                        transition: "all 0.2s ease",
                        fontWeight: targetMonitorIds.includes(id) ? "600" : "normal",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={targetMonitorIds.includes(id)}
                        onChange={() => toggleMonitorId(id)}
                        style={{ cursor: "pointer" }}
                      />
                      {id === 0 ? "すべて" : `モニター${id}`}
                    </label>
                  ))}
                </div>
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "#555",
                    margin: 0,
                    fontStyle: "italic",
                  }}
                >
                  💡 各キャスターが担当するモニターIDを指定できます。「すべて」を選択すると全モニターに送信されます。
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontWeight: "600", fontSize: "0.95rem", color: "#000" }}>
                  優先度:
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {[
                    { value: "normal", label: "通常", color: "#333", bg: "#f0f0f0", desc: "通常のメッセージ" },
                    { value: "high", label: "重要", color: "#ff8800", bg: "#ffeecc", desc: "注意が必要" },
                    { value: "urgent", label: "緊急", color: "#ff0000", bg: "#ffcccc", desc: "即座の対応が必要" },
                  ].map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setPriority(p.value as Priority)}
                      style={{
                        flex: 1,
                        padding: "0.75rem",
                        borderRadius: "4px",
                        border: priority === p.value ? `2px solid ${p.color}` : "2px solid #ddd",
                        backgroundColor: priority === p.value ? p.bg : "white",
                        color: priority === p.value ? p.color : "#333",
                        cursor: "pointer",
                        fontWeight: priority === p.value ? "700" : "500",
                        fontSize: "0.95rem",
                        transition: "all 0.2s ease",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem",
                      }}
                      title={p.desc}
                    >
                      <span>{p.label}</span>
                      <span style={{ fontSize: "0.75rem", fontWeight: "normal", color: priority === p.value ? "inherit" : "#555" }}>
                        {p.desc}
                      </span>
                    </button>
                  ))}
                </div>
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "#555",
                    margin: 0,
                    fontStyle: "italic",
                  }}
                >
                  💡 優先度によってキャスター側の表示色と背景色が変わります
                </p>
              </div>

              <button
                onClick={handleSendMessage}
                disabled={!messageContent.trim() || targetMonitorIds.length === 0}
                style={{
                  padding: "1rem",
                  fontSize: "1.1rem",
                  fontWeight: "600",
                  backgroundColor: messageContent.trim() && targetMonitorIds.length > 0 ? "#667eea" : "#d1d5db",
                  color: messageContent.trim() && targetMonitorIds.length > 0 ? "white" : "#6b7280",
                  border: "none",
                  borderRadius: "6px",
                  cursor: messageContent.trim() && targetMonitorIds.length > 0 ? "pointer" : "not-allowed",
                  transition: "all 0.2s ease",
                  marginTop: "auto",
                }}
              >
                📤 メッセージを送信
              </button>
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
              borderRadius: "8px",
              maxHeight: "40%",
              overflowY: "auto",
              backgroundColor: "white",
            }}
          >
            <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: "0.5rem", color: "#000" }}>
              👥 接続中のキャスター
              <span
                style={{
                  fontSize: "0.9rem",
                  fontWeight: "normal",
                  color: "#555",
                }}
              >
                ({serverState.clients.length})
              </span>
            </h3>
            {serverState.clients.length === 0 ? (
              <p style={{ color: "#555", fontStyle: "italic" }}>
                キャスターの接続を待っています...
              </p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {serverState.clients.map((client) => (
                  <li
                    key={client.client_id}
                    style={{
                      padding: "0.75rem",
                      marginBottom: "0.5rem",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      backgroundColor: "#f9f9f9",
                    }}
                  >
                    <div style={{ fontWeight: "600", fontSize: "1rem", marginBottom: "0.25rem" }}>
                      {client.name}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#555" }}>
                      担当モニター: {client.monitor_ids.map(id => `#${id}`).join(", ")}
                    </div>
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
              borderRadius: "8px",
              flex: 1,
              overflowY: "auto",
              backgroundColor: "white",
            }}
          >
            <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: "0.5rem", color: "#000" }}>
              💬 フィードバック
              <span
                style={{
                  fontSize: "0.9rem",
                  fontWeight: "normal",
                  color: "#555",
                }}
              >
                ({serverState.feedbackMessages.length})
              </span>
            </h3>
            {serverState.feedbackMessages.length === 0 ? (
              <p style={{ color: "#555", fontStyle: "italic" }}>
                フィードバックはまだありません
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {serverState.feedbackMessages
                  .slice()
                  .reverse()
                  .map((msg) => {
                    if (msg.type === "feedback_message") {
                      const feedbackTypeEmoji = {
                        ack: "✓",
                        question: "?",
                        issue: "⚠",
                        info: "ℹ",
                      }[msg.payload.feedback_type] || "•";

                      return (
                        <div
                          key={msg.id}
                          style={{
                            padding: "0.75rem",
                            border: "1px solid #ddd",
                            borderRadius: "6px",
                            backgroundColor: "#f9f9f9",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                            <strong style={{ color: "#667eea" }}>
                              モニター {msg.payload.source_monitor_id}
                            </strong>
                            <span style={{ fontSize: "0.8em", color: "#555" }}>
                              {formatTimestamp(msg.timestamp)}
                            </span>
                          </div>
                          <div style={{ fontSize: "1rem", marginBottom: "0.25rem" }}>
                            {msg.payload.content}
                          </div>
                          <div style={{ fontSize: "0.85em", color: "#555" }}>
                            {feedbackTypeEmoji} {msg.payload.feedback_type}
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
