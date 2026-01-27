import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useServerState } from "../hooks/useServerState";
import { useTemplates } from "../hooks/useTemplates";
import { TemplateManager } from "./TemplateManager";
import type { Priority, ServerTemplate } from "../types/messages";

interface ServerViewProps {
  onBackToMenu: () => void;
}

export function ServerView({ onBackToMenu }: ServerViewProps) {
  const serverState = useServerState();
  const templates = useTemplates();
  const [port, setPort] = useState<number>(9876);
  const [messageContent, setMessageContent] = useState<string>("");
  const [targetMonitorIds, setTargetMonitorIds] = useState<number[]>([0]);
  const [priority, setPriority] = useState<Priority>("normal");
  const [error, setError] = useState<string | null>(null);
  const [showMonitorManagement, setShowMonitorManagement] = useState<boolean>(false);
  const [showTemplateManagement, setShowTemplateManagement] = useState<boolean>(false);
  const [newMonitorName, setNewMonitorName] = useState<string>("");
  const [newMonitorDescription, setNewMonitorDescription] = useState<string>("");
  const [newMonitorColor, setNewMonitorColor] = useState<string>("#667eea");

  const handleBackToMenu = async () => {
    if (serverState.isRunning) {
      const confirmed = window.confirm(
        "サーバーが起動中です。停止してメインメニューに戻りますか？"
      );
      if (!confirmed) {
        return;
      }
      await handleStopServer();
    }
    onBackToMenu();
  };

  // Get monitors from server state
  const availableMonitors = serverState.monitors;

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

  const handleSendFlash = async () => {
    try {
      setError(null);
      await invoke("send_flash_command", {
        targetMonitorIds,
      });
    } catch (err) {
      setError(String(err));
    }
  };

  const handleSendClear = async () => {
    try {
      setError(null);
      await invoke("send_clear_command", {
        targetMonitorIds,
      });
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
        return newIds.includes(id)
          ? newIds.filter((i) => i !== id)
          : [...newIds, id];
      });
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const handleAddMonitor = async () => {
    if (!newMonitorName.trim()) {
      setError("Monitor name cannot be empty");
      return;
    }

    try {
      setError(null);
      await invoke("add_virtual_monitor", {
        name: newMonitorName,
        description: newMonitorDescription || null,
        color: newMonitorColor || null,
      });
      setNewMonitorName("");
      setNewMonitorDescription("");
      setNewMonitorColor("#667eea");
    } catch (err) {
      setError(String(err));
    }
  };

  const handleRemoveMonitor = async (monitorId: number) => {
    try {
      setError(null);
      await invoke("remove_virtual_monitor", { monitorId });
      // Remove from target if selected
      setTargetMonitorIds((prev) => prev.filter((id) => id !== monitorId));
    } catch (err) {
      setError(String(err));
    }
  };

  const handleSelectTemplate = (template: ServerTemplate) => {
    setMessageContent(template.content);
    setPriority(template.priority);
  };

  // Cleanup: stop server when component unmounts
  useEffect(() => {
    return () => {
      if (serverState.isRunning) {
        invoke("stop_server").catch((err) => {
          console.error("Failed to stop server on unmount:", err);
        });
      }
    };
  }, [serverState.isRunning]);

  return (
    <div style={{ padding: "1rem", display: "flex", gap: "1rem", height: "100vh", backgroundColor: "#f5f5f5" }}>
      {/* Left Panel - Server Controls and Message Input */}
      <div className="scrollable" style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1rem", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: "1.8rem", color: "#667eea" }}>
            🎬 カンペモード
          </h2>
          <button
            onClick={handleBackToMenu}
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
                {" - "}<span style={{ color: "#000" }}>ポート</span> <strong style={{ fontSize: "1.1rem", color: "#1f2937" }}>{serverState.port}</strong>
              </p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
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
                  }}
                >
                  ⏹ サーバー停止
                </button>
                <button
                  onClick={() => setShowMonitorManagement(!showMonitorManagement)}
                  style={{
                    padding: "0.5rem 1.5rem",
                    fontSize: "1rem",
                    fontWeight: "600",
                    backgroundColor: "#8b5cf6",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  📺 モニター管理
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Monitor Management Panel */}
        {serverState.isRunning && showMonitorManagement ? (
          <div
            style={{
              border: "2px solid #8b5cf6",
              padding: "1.5rem",
              borderRadius: "8px",
              backgroundColor: "white",
            }}
          >
            <h3 style={{ marginTop: 0, color: "#8b5cf6", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              📺 仮想モニター管理
            </h3>

            {/* Add Monitor Form */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              padding: "1rem",
              backgroundColor: "#fafafa",
              borderRadius: "6px",
              marginBottom: "1rem",
            }}>
              <h4 style={{ margin: 0, fontSize: "0.95rem", color: "#333" }}>➕ 新しいモニターを追加</h4>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "#555" }}>
                  モニター名 <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  value={newMonitorName}
                  onChange={(e) => setNewMonitorName(e.target.value)}
                  placeholder="例: キャスターA、ホスト"
                  style={{
                    padding: "0.75rem",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                    fontSize: "1rem",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "#555" }}>
                  説明（任意）
                </label>
                <input
                  type="text"
                  value={newMonitorDescription}
                  onChange={(e) => setNewMonitorDescription(e.target.value)}
                  placeholder="例: メインキャスター、MCタレント"
                  style={{
                    padding: "0.75rem",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                    fontSize: "1rem",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flex: "0 0 auto" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "#555" }}>
                    識別色
                  </label>
                  <input
                    type="color"
                    value={newMonitorColor}
                    onChange={(e) => setNewMonitorColor(e.target.value)}
                    style={{
                      width: "80px",
                      height: "40px",
                      padding: "0.25rem",
                      borderRadius: "4px",
                      border: "1px solid #ccc",
                      cursor: "pointer",
                    }}
                  />
                </div>

                <button
                  onClick={handleAddMonitor}
                  style={{
                    padding: "0.75rem 1.5rem",
                    fontSize: "1rem",
                    fontWeight: "600",
                    backgroundColor: "#22c55e",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    flex: 1,
                  }}
                >
                  ➕ モニターを追加
                </button>
              </div>
            </div>

            {/* Monitor List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem", color: "#333" }}>
                登録済みモニター ({availableMonitors.length}個)
              </h4>
              <div className="scrollable" style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                maxHeight: "250px",
                overflowY: "auto",
                padding: "0.5rem",
              }}>
                {availableMonitors.length === 0 ? (
                  <div style={{
                    padding: "2rem",
                    textAlign: "center",
                    color: "#999",
                    fontStyle: "italic",
                  }}>
                    まだモニターが登録されていません
                  </div>
                ) : (
                  availableMonitors.map((monitor) => (
                    <div
                      key={monitor.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                        padding: "1rem",
                        borderRadius: "6px",
                        backgroundColor: "#ffffff",
                        border: "2px solid #e5e7eb",
                        borderLeft: monitor.color ? `6px solid ${monitor.color}` : "6px solid #ccc",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontWeight: "700",
                          fontSize: "1rem",
                          color: "#1f2937",
                          marginBottom: "0.25rem",
                        }}>
                          📺 {monitor.name}
                          <span style={{
                            marginLeft: "0.5rem",
                            fontSize: "0.85rem",
                            fontWeight: "500",
                            color: "#6b7280",
                            backgroundColor: "#f3f4f6",
                            padding: "0.125rem 0.5rem",
                            borderRadius: "3px",
                          }}>
                            ID: {monitor.id}
                          </span>
                        </div>
                        {monitor.description && (
                          <div style={{
                            fontSize: "0.85rem",
                            color: "#6b7280",
                            fontStyle: "italic",
                          }}>
                            {monitor.description}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveMonitor(monitor.id)}
                        style={{
                          padding: "0.5rem 1rem",
                          fontSize: "0.9rem",
                          fontWeight: "600",
                          backgroundColor: "#ef4444",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#dc2626";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#ef4444";
                        }}
                      >
                        🗑 削除
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Template Management Panel */}
        {serverState.isRunning && showTemplateManagement && templates.config ? (
          <div
            style={{
              border: "2px solid #8b5cf6",
              padding: "1.5rem",
              borderRadius: "8px",
              backgroundColor: "white",
            }}
          >
            <TemplateManager
              mode="server"
              serverTemplates={templates.config.server_templates}
              clientTemplates={[]}
              onAddServerTemplate={templates.addServerTemplate}
              onUpdateServerTemplate={templates.updateServerTemplate}
              onDeleteServerTemplate={templates.deleteServerTemplate}
              onAddClientTemplate={async () => {}}
              onUpdateClientTemplate={async () => {}}
              onDeleteClientTemplate={async () => {}}
              onSelectTemplate={(template) => handleSelectTemplate(template as ServerTemplate)}
            />
          </div>
        ) : null}

        {/* Message Input */}
        {serverState.isRunning ? (
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <h3 style={{ margin: 0, color: "#000" }}>メッセージ送信</h3>
              <button
                onClick={() => setShowTemplateManagement(!showTemplateManagement)}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.9rem",
                  fontWeight: "600",
                  backgroundColor: "#8b5cf6",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                📝 テンプレート
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", flex: 1 }}>
              {/* Template Quick Access */}
              {templates.config && templates.config.server_templates.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <label style={{ fontWeight: "600", fontSize: "0.85rem", color: "#555" }}>
                    クイックテンプレート:
                  </label>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {templates.config.server_templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleSelectTemplate(template)}
                        style={{
                          padding: "0.5rem 1rem",
                          fontSize: "0.9rem",
                          fontWeight: "500",
                          backgroundColor: "#f3f4f6",
                          color: "#374151",
                          border: "1px solid #d1d5db",
                          borderRadius: "4px",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#e5e7eb";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#f3f4f6";
                        }}
                      >
                        {template.content}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                    gap: "0.5rem",
                    padding: "0.75rem",
                    backgroundColor: "white",
                    borderRadius: "4px",
                    border: "1px solid #ddd",
                  }}
                >
                  {/* All monitors option */}
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.5rem",
                      borderRadius: "4px",
                      cursor: "pointer",
                      backgroundColor: targetMonitorIds.includes(0)
                        ? "#667eea"
                        : "#f5f5f5",
                      color: targetMonitorIds.includes(0) ? "white" : "#333",
                      transition: "all 0.2s ease",
                      fontWeight: targetMonitorIds.includes(0) ? "600" : "normal",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={targetMonitorIds.includes(0)}
                      onChange={() => toggleMonitorId(0)}
                      style={{ cursor: "pointer" }}
                    />
                    すべて
                  </label>

                  {/* Individual monitors */}
                  {availableMonitors.map((monitor) => (
                    <label
                      key={monitor.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.5rem",
                        borderRadius: "4px",
                        cursor: "pointer",
                        backgroundColor: targetMonitorIds.includes(monitor.id)
                          ? "#667eea"
                          : "#f5f5f5",
                        color: targetMonitorIds.includes(monitor.id) ? "white" : "#333",
                        transition: "all 0.2s ease",
                        fontWeight: targetMonitorIds.includes(monitor.id) ? "600" : "normal",
                        borderLeft: monitor.color && !targetMonitorIds.includes(monitor.id)
                          ? `4px solid ${monitor.color}`
                          : "none",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={targetMonitorIds.includes(monitor.id)}
                        onChange={() => toggleMonitorId(monitor.id)}
                        style={{ cursor: "pointer" }}
                      />
                      {monitor.name}
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
                    { value: "normal", label: "通常", emoji: "📝", color: "#333", bg: "#f0f0f0", desc: "通常のメッセージ" },
                    { value: "high", label: "重要", emoji: "⚠", color: "#ff8800", bg: "#ffeecc", desc: "注意が必要" },
                    { value: "urgent", label: "緊急", emoji: "🚨", color: "#ff0000", bg: "#ffcccc", desc: "即座の対応が必要" },
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
                      <span style={{ fontSize: "1.2rem" }}>{p.emoji}</span>
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

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={handleSendFlash}
                  disabled={targetMonitorIds.length === 0}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    fontSize: "1rem",
                    fontWeight: "600",
                    backgroundColor: targetMonitorIds.length > 0 ? "#f59e0b" : "#d1d5db",
                    color: targetMonitorIds.length > 0 ? "white" : "#6b7280",
                    border: "none",
                    borderRadius: "6px",
                    cursor: targetMonitorIds.length > 0 ? "pointer" : "not-allowed",
                    transition: "all 0.2s ease",
                  }}
                  title="選択したモニターに点滅を送信"
                >
                  ⚡ 点滅
                </button>
                <button
                  onClick={handleSendClear}
                  disabled={targetMonitorIds.length === 0}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    fontSize: "1rem",
                    fontWeight: "600",
                    backgroundColor: targetMonitorIds.length > 0 ? "#ef4444" : "#d1d5db",
                    color: targetMonitorIds.length > 0 ? "white" : "#6b7280",
                    border: "none",
                    borderRadius: "6px",
                    cursor: targetMonitorIds.length > 0 ? "pointer" : "not-allowed",
                    transition: "all 0.2s ease",
                  }}
                  title="選択したモニターの表示をクリア"
                >
                  🗑 クリア
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Error Display */}
        {error ? (
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
        ) : null}
      </div>

      {/* Right Panel - Connected Clients and Feedback */}
      {serverState.isRunning ? (
        <div className="scrollable" style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1rem", overflowY: "auto" }}>
          {/* Connected Clients */}
          <div
            className="scrollable"
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
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <div style={{ fontWeight: "600", fontSize: "1rem", marginBottom: "0.25rem", color: "#1f2937" }}>
                      {client.name}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#374151" }}>
                      担当モニター: {client.monitor_ids.map(id => `#${id}`).join(", ")}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Sent Messages and Feedback */}
          <div
            className="scrollable"
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
              📤 送信メッセージとフィードバック
              <span
                style={{
                  fontSize: "0.9rem",
                  fontWeight: "normal",
                  color: "#555",
                }}
              >
                ({serverState.sentMessages.length})
              </span>
            </h3>
            {serverState.sentMessages.length === 0 ? (
              <p style={{ color: "#555", fontStyle: "italic" }}>
                まだメッセージを送信していません
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {serverState.sentMessages
                  .slice()
                  .reverse()
                  .map((msg) => {
                    if (msg.type === "kanpe_message") {
                      // Find all feedback for this message
                      const feedbacks = serverState.feedbackMessages.filter(
                        (fb) => fb.type === "feedback_message" && fb.payload.reply_to_message_id === msg.id
                      );

                      const feedbackTypeEmoji = {
                        ack: "✓",
                        question: "?",
                        issue: "⚠",
                        info: "ℹ",
                      };

                      const priorityColor = {
                        urgent: "#ff0000",
                        high: "#ff8800",
                        normal: "#333",
                      }[msg.payload.priority] || "#333";

                      return (
                        <div
                          key={msg.id}
                          style={{
                            padding: "1rem",
                            border: "2px solid #e5e7eb",
                            borderRadius: "8px",
                            backgroundColor: "#fafafa",
                          }}
                        >
                          {/* Sent Message */}
                          <div style={{ marginBottom: "0.75rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <span style={{ fontSize: "1.1rem", fontWeight: "600", color: priorityColor }}>
                                  📢 {msg.payload.content}
                                </span>
                                <span
                                  style={{
                                    fontSize: "0.75rem",
                                    padding: "0.125rem 0.5rem",
                                    borderRadius: "3px",
                                    backgroundColor: priorityColor,
                                    color: "white",
                                    fontWeight: "600",
                                  }}
                                >
                                  {msg.payload.priority === "urgent" ? "🚨 緊急" : msg.payload.priority === "high" ? "⚠ 重要" : "📝 通常"}
                                </span>
                              </div>
                              <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                                {formatTimestamp(msg.timestamp)}
                              </span>
                            </div>
                            <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                              送信先: モニター {msg.payload.target_monitor_ids.includes(0) ? "全て" : msg.payload.target_monitor_ids.join(", ")}
                            </div>
                          </div>

                          {/* Feedback for this message */}
                          <div
                            style={{
                              paddingLeft: "1rem",
                              borderLeft: "3px solid #d1d5db",
                            }}
                          >
                            {feedbacks.length === 0 ? (
                              <div style={{ fontSize: "0.9rem", color: "#9ca3af", fontStyle: "italic" }}>
                                💤 未応答
                              </div>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                {feedbacks.map((fb) => {
                                  if (fb.type === "feedback_message") {
                                    return (
                                      <div
                                        key={fb.id}
                                        style={{
                                          padding: "0.5rem",
                                          borderRadius: "4px",
                                          backgroundColor: "#ffffff",
                                          border: "1px solid #e5e7eb",
                                        }}
                                      >
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                                          <strong style={{ color: "#667eea", fontSize: "0.9rem" }}>
                                            {feedbackTypeEmoji[fb.payload.feedback_type] || "•"} {fb.payload.client_name}
                                          </strong>
                                          <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                                            {formatTimestamp(fb.timestamp)}
                                          </span>
                                        </div>
                                        <div style={{ fontSize: "0.9rem", color: "#374151" }}>
                                          {fb.payload.content}
                                        </div>
                                        <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.125rem" }}>
                                          [{fb.payload.feedback_type}]
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
                      );
                    }
                    return null;
                  })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
