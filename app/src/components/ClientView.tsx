import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useClientState } from "../hooks/useClientState";
import { useTemplates } from "../hooks/useTemplates";
import { TemplateManager } from "./TemplateManager";
import type { FeedbackType } from "../types/messages";

interface ClientViewProps {
  onBackToMenu: () => void;
}

export function ClientView({ onBackToMenu }: ClientViewProps) {
  const [serverAddress, setServerAddress] = useState<string>("localhost:9876");
  const [clientName, setClientName] = useState<string>("Caster 1");
  const [displayMonitorIds, setDisplayMonitorIds] = useState<number[]>([1]);
  const [error, setError] = useState<string | null>(null);
  const [showConnectionPanel, setShowConnectionPanel] = useState<boolean>(true);
  const [showTemplateManagement, setShowTemplateManagement] = useState<boolean>(false);

  const clientState = useClientState(displayMonitorIds);
  const templates = useTemplates();

  // Get available monitor IDs from server
  const availableMonitors = clientState.availableMonitors;

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

  const handleBackToMenu = async () => {
    if (clientState.isConnected) {
      const confirmed = window.confirm(
        "サーバーに接続中です。切断してメインメニューに戻りますか？"
      );
      if (!confirmed) {
        return;
      }
      await handleDisconnect();
    }
    onBackToMenu();
  };

  const handleSendFeedback = async (
    content: string,
    feedbackType: FeedbackType
  ) => {
    if (!currentMessage) {
      setError("返信対象のメッセージがありません");
      return;
    }

    try {
      setError(null);
      await invoke("send_feedback", {
        content,
        clientName,
        replyToMessageId: currentMessage.id,
        feedbackType,
      });
    } catch (err) {
      setError(String(err));
    }
  };

  const toggleMonitorId = (id: number) => {
    setDisplayMonitorIds((prev) =>
      prev.includes(id)
        ? prev.filter((i) => i !== id)
        : [...prev, id]
    );
  };

  // Cleanup: disconnect from server when component unmounts
  useEffect(() => {
    return () => {
      if (clientState.isConnected) {
        invoke("disconnect_from_server").catch((err) => {
          console.error("Failed to disconnect from server on unmount:", err);
        });
      }
    };
  }, [clientState.isConnected]);

  const handlePopoutMonitor = async (monitorId: number, monitorName: string) => {
    try {
      await invoke("create_popout_window", {
        monitorId,
        monitorName,
      });
    } catch (err) {
      setError(String(err));
    }
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
      {showConnectionPanel ? (
        <div
          style={{
            padding: "1.5rem",
            borderBottom: "2px solid #764ba2",
            backgroundColor: "#f9f9f9",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <h2 style={{ margin: 0, color: "#764ba2", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              🎤 キャスターモード
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
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              maxWidth: "700px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ fontWeight: "600", color: "#000" }}>サーバーアドレス:</label>
              <input
                type="text"
                value={serverAddress}
                onChange={(e) => setServerAddress(e.target.value)}
                placeholder="localhost:9876"
                style={{
                  padding: "0.75rem",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  fontSize: "1rem",
                  width: "100%",
                }}
                disabled={clientState.isConnected}
              />
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#555", fontStyle: "italic" }}>
                💡 カンペが起動したサーバーのアドレスとポート番号
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ fontWeight: "600", color: "#000" }}>キャスター名:</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Caster 1"
                style={{
                  padding: "0.75rem",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  fontSize: "1rem",
                  width: "100%",
                }}
                disabled={clientState.isConnected}
              />
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#555", fontStyle: "italic" }}>
                💡 カンペ側に表示される識別名
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ fontWeight: "600", color: "#000" }}>担当モニターID:</label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: "0.5rem",
                }}
              >
                {availableMonitors.length > 0 ? (
                  availableMonitors.map((monitor) => (
                    <div
                      key={monitor.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.75rem",
                        borderRadius: "4px",
                        backgroundColor: displayMonitorIds.includes(monitor.id)
                          ? "#764ba2"
                          : "#f5f5f5",
                        color: displayMonitorIds.includes(monitor.id) ? "white" : "#333",
                        fontWeight: displayMonitorIds.includes(monitor.id) ? "600" : "normal",
                        transition: "all 0.2s ease",
                        borderLeft: monitor.color ? `4px solid ${monitor.color}` : "none",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={displayMonitorIds.includes(monitor.id)}
                        onChange={() => toggleMonitorId(monitor.id)}
                        disabled={clientState.isConnected}
                        style={{ cursor: clientState.isConnected ? "not-allowed" : "pointer" }}
                      />
                      <span style={{ flex: 1 }}>{monitor.name}</span>
                      {clientState.isConnected && (
                        <button
                          onClick={() => handlePopoutMonitor(monitor.id, monitor.name)}
                          style={{
                            padding: "0.25rem 0.5rem",
                            fontSize: "0.75rem",
                            backgroundColor: "#667eea",
                            color: "white",
                            border: "none",
                            borderRadius: "3px",
                            cursor: "pointer",
                          }}
                          title="ポップアウト"
                        >
                          🗗
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "1rem", color: "#999", textAlign: "center" }}>
                    サーバーに接続してモニター一覧を取得してください
                  </div>
                )}
              </div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#555", fontStyle: "italic" }}>
                💡 このキャスターが表示するモニターIDを選択（複数可）。接続後は🗗ボタンで別ウィンドウに表示できます。
              </p>
            </div>

            <div style={{ marginTop: "0.5rem" }}>
              {!clientState.isConnected ? (
                <button
                  onClick={handleConnect}
                  style={{
                    padding: "0.75rem 2rem",
                    fontSize: "1.1rem",
                    fontWeight: "600",
                    backgroundColor: "#764ba2",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  🔗 サーバーに接続
                </button>
              ) : (
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                  <span
                    style={{
                      color: "#22c55e",
                      marginRight: "1rem",
                      fontWeight: "600",
                      fontSize: "1.1rem",
                    }}
                  >
                    ● 接続中:{" "}
                    <span style={{ color: "#1f2937", backgroundColor: "#e5e7eb", padding: "0.25rem 0.5rem", borderRadius: "4px" }}>
                      {clientState.serverAddress}
                    </span>
                  </span>
                  <button
                    onClick={handleDisconnect}
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
                    切断
                  </button>
                  <button
                    onClick={() => setShowConnectionPanel(false)}
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
                    パネルを隠す
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div
                style={{
                  padding: "0.75rem",
                  backgroundColor: "#ffcccc",
                  border: "2px solid #ff0000",
                  borderRadius: "6px",
                  fontWeight: "600",
                }}
              >
                ❌ エラー: {error}
              </div>
            )}
          </div>
        </div>
      ) : null}

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
          transition: "background-color 0.3s ease",
        }}
      >
        {!clientState.isConnected ? (
          <div style={{ textAlign: "center", color: "#555", padding: "2rem" }}>
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🔌</div>
            <p style={{ fontSize: "1.8rem", fontWeight: "600", margin: "0 0 0.5rem 0" }}>
              サーバー未接続
            </p>
            <p style={{ fontSize: "1.1rem", margin: 0 }}>
              上部の設定パネルからカンペのサーバーに接続してください
            </p>
          </div>
        ) : currentMessage && currentMessage.type === "kanpe_message" ? (
          <div
            style={{
              textAlign: "center",
              padding: "3rem",
              maxWidth: "85%",
            }}
          >
            <div
              style={{
                fontSize: "4rem",
                fontWeight: "bold",
                color: getPriorityColor(currentMessage.payload.priority),
                marginBottom: "1.5rem",
                whiteSpace: "pre-wrap",
                lineHeight: "1.3",
                textShadow: currentMessage.payload.priority === "urgent"
                  ? "2px 2px 4px rgba(0,0,0,0.2)"
                  : "none",
              }}
            >
              {currentMessage.payload.content}
            </div>
            <div
              style={{
                fontSize: "1.2rem",
                fontWeight: "600",
                color: getPriorityColor(currentMessage.payload.priority),
                padding: "0.5rem 1.5rem",
                borderRadius: "20px",
                backgroundColor: "#ffffff",
                border: "2px solid " + getPriorityColor(currentMessage.payload.priority),
                display: "inline-block",
              }}
            >
              {currentMessage.payload.priority === "urgent"
                ? "🚨 緊急"
                : currentMessage.payload.priority === "high"
                ? "⚠ 重要"
                : "📝 通常"}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", color: "#555", padding: "2rem" }}>
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>💤</div>
            <p style={{ fontSize: "1.8rem", fontWeight: "600", margin: "0 0 0.5rem 0" }}>
              待機中...
            </p>
            <p style={{ fontSize: "1.1rem", margin: 0, color: "#22c55e" }}>
              ● {clientState.serverName || "サーバー"}に接続中
            </p>
          </div>
        )}

        {/* Show/Hide Connection Panel Toggle (when connected) */}
        {!showConnectionPanel && clientState.isConnected ? (
          <button
            onClick={() => setShowConnectionPanel(true)}
            style={{
              position: "absolute",
              top: "1rem",
              right: "1rem",
              padding: "0.75rem 1.5rem",
              fontSize: "1rem",
              fontWeight: "600",
              backgroundColor: "rgba(118, 75, 162, 0.9)",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
          >
            ⚙ 設定を表示
          </button>
        ) : null}
      </div>

      {/* Template Management Panel */}
      {clientState.isConnected && showTemplateManagement && templates.config ? (
        <div
          style={{
            padding: "1.5rem",
            borderTop: "2px solid #8b5cf6",
            backgroundColor: "white",
          }}
        >
          <TemplateManager
            mode="client"
            serverTemplates={[]}
            clientTemplates={templates.config.client_templates}
            onAddServerTemplate={async () => {}}
            onUpdateServerTemplate={async () => {}}
            onDeleteServerTemplate={async () => {}}
            onAddClientTemplate={templates.addClientTemplate}
            onUpdateClientTemplate={templates.updateClientTemplate}
            onDeleteClientTemplate={templates.deleteClientTemplate}
          />
        </div>
      ) : null}

      {/* Feedback Buttons */}
      {clientState.isConnected ? (
        <div
          style={{
            padding: "1.5rem",
            borderTop: "2px solid #ccc",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            backgroundColor: "#f9f9f9",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.95rem", fontWeight: "600", color: "#333" }}>
              フィードバック送信
            </span>
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
              📝 テンプレート管理
            </button>
          </div>

          <div
            style={{
              display: "flex",
              gap: "1rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            {templates.config && templates.config.client_templates.length > 0 ? (
              templates.config.client_templates.map((template) => {
                const feedbackTypeConfig = {
                  ack: { emoji: "✓", label: "了解", color: "#22c55e" },
                  question: { emoji: "?", label: "質問", color: "#3b82f6" },
                  issue: { emoji: "⚠", label: "問題報告", color: "#f59e0b" },
                  info: { emoji: "ℹ", label: "情報", color: "#8b5cf6" },
                }[template.feedback_type] || { emoji: "•", label: template.feedback_type, color: "#6b7280" };

                return (
                  <button
                    key={template.id}
                    onClick={() => handleSendFeedback(template.content, template.feedback_type)}
                    disabled={!currentMessage}
                    style={{
                      padding: "1rem 2rem",
                      fontSize: "1.1rem",
                      fontWeight: "600",
                      backgroundColor: currentMessage ? feedbackTypeConfig.color : "#ccc",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: currentMessage ? "pointer" : "not-allowed",
                      transition: "all 0.2s ease",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "0.25rem",
                      opacity: currentMessage ? 1 : 0.5,
                    }}
                    onMouseEnter={(e) => {
                      if (currentMessage) e.currentTarget.style.transform = "scale(1.05)";
                    }}
                    onMouseLeave={(e) => {
                      if (currentMessage) e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    <span style={{ fontSize: "1.5rem" }}>{feedbackTypeConfig.emoji}</span>
                    <span>{template.content}</span>
                  </button>
                );
              })
            ) : (
              <p style={{ color: "#999", fontStyle: "italic", margin: 0 }}>
                テンプレートがありません。テンプレート管理から追加してください。
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
