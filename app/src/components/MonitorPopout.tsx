import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useClientState } from "../hooks/useClientState";
import { useTemplates } from "../hooks/useTemplates";
import { TemplateManager } from "./TemplateManager";
import { ThemeToggle } from "./ThemeToggle";
import type { ClientTemplate } from "../types/messages";

// Hoist feedback type colors to avoid recreation on every render
const FEEDBACK_TYPE_COLORS = {
  ack: { bg: "#22c55e", label: "✓ 了解" },
  question: { bg: "#3b82f6", label: "? 質問" },
  issue: { bg: "#ef4444", label: "⚠ 問題" },
  info: { bg: "#6b7280", label: "ℹ 情報" },
} as const;

interface MonitorPopoutProps {
  monitorId: string;
  monitorName: string;
}

export default function MonitorPopout({
  monitorId,
  monitorName,
}: MonitorPopoutProps) {
  const clientState = useClientState([monitorId]);
  const templates = useTemplates();
  const [fontSize, setFontSize] = useState<number>(4);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [isSendingFeedback, setIsSendingFeedback] = useState<boolean>(false);
  const [feedbackSent, setFeedbackSent] = useState<boolean>(false);
  const [showFeedbackPanel, setShowFeedbackPanel] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"reply" | "new" | "template">("new");
  // Load font size from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("clientFontSize");
    if (saved) {
      setFontSize(Number(saved));
    }
  }, []);

  // Save font size to localStorage
  useEffect(() => {
    localStorage.setItem("clientFontSize", fontSize.toString());
  }, [fontSize]);

  // Handle flash trigger
  useEffect(() => {
    if (clientState.flashTrigger > 0) {
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [clientState.flashTrigger]);

  // Memoize the most recent message for this monitor
  const currentMessage = useMemo(() => {
    return clientState.messages
      .filter((msg) => {
        if (msg.type === "kanpe_message") {
          const targetIds = msg.payload.target_monitor_ids;
          return targetIds.includes("ALL") || targetIds.includes(monitorId);
        }
        return false;
      })
      .slice(-1)[0];
  }, [clientState.messages, monitorId]);

  // このモニターに紐づいたタイマーのみ表示
  const visibleTimers = useMemo(() => {
    const entries = clientState.timers?.timers ?? [];
    if (entries.length === 0) return [];
    return entries.filter((e) => {
      const t = e.definition.target_monitor_ids ?? [];
      return t.includes("ALL") || t.includes(monitorId);
    });
  }, [clientState.timers, monitorId]);

  // Auto-switch tabs based on message availability
  useEffect(() => {
    setActiveTab((prevTab) => {
      if (currentMessage) {
        // If there's a message and we're on new/template tab, switch to reply
        if (prevTab === "new" || prevTab === "template") {
          return "reply";
        }
      } else {
        // If there's no message and we're on reply tab, switch to new
        if (prevTab === "reply") {
          return "new";
        }
      }
      return prevTab;
    });
  }, [currentMessage]);

  // Handle template button click - directly send
  const handleTemplateClick = async (template: ClientTemplate) => {
    try {
      setIsSendingFeedback(true);
      const clientName = localStorage.getItem("clientName") || "Unknown Client";
      const replyTo = activeTab === "new" ? "" : (currentMessage?.id || "");

      console.log("Sending feedback:", {
        content: template.content,
        clientName,
        replyToMessageId: replyTo,
        feedbackType: template.feedback_type,
        activeTab,
        hasCurrentMessage: !!currentMessage,
      });

      await invoke("send_feedback", {
        content: template.content,
        clientName,
        replyToMessageId: replyTo,
        feedbackType: template.feedback_type,
      });

      console.log("Feedback sent successfully");
      setFeedbackSent(true);
      setTimeout(() => setFeedbackSent(false), 1500);
    } catch (err) {
      console.error("Failed to send feedback:", err);
    } finally {
      setIsSendingFeedback(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "#ff0000";
      case "high":
        return "#ff8800";
      default:
        return "var(--text-color)";
    }
  };

  const getPriorityBackgroundColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "rgba(255, 0, 0, 0.1)";
      case "high":
        return "rgba(255, 136, 0, 0.1)";
      default:
        return "var(--bg-color)";
    }
  };

  if (!clientState.isConnected) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🔌</div>
          <h1 style={{ fontSize: "2rem", fontWeight: "600", marginBottom: "0.5rem" }}>切断中</h1>
          <p style={{ color: "var(--muted-text)" }}>メインウィンドウでサーバーに接続してください</p>
        </div>
      </div>
    );
  }

  const formatTimerStateLabel = (state: string) =>
    state === "running"
      ? "▶ 進行中"
      : state === "paused"
        ? "⏸ 一時停止"
        : state === "completed"
          ? "✓ 完了"
          : state === "cancelled"
            ? "✕ 中止"
            : "待機中";

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}>
      {/* カンペメッセージ（中央）＋ その下・画面下中央にタイマーでっかく */}
      <div
        className={isFlashing ? "flash-animation" : ""}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: currentMessage
            ? getPriorityBackgroundColor(
                (currentMessage as any).payload?.priority || "normal"
              )
            : "var(--bg-color)",
          position: "relative",
          transition: "background-color 0.3s ease",
        }}
      >
        {/* カンペメッセージエリア（中央） */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
        {currentMessage && currentMessage.type === "kanpe_message" ? (
          <div
            style={{
              textAlign: "center",
              padding: "3rem",
              maxWidth: "85%",
            }}
          >
            <div
              style={{
                fontSize: `${fontSize}rem`,
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
                backgroundColor: "var(--card-bg)",
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
          <div style={{ textAlign: "center", color: "var(--muted-text)", padding: "2rem" }}>
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>💤</div>
            <p style={{ fontSize: "1.8rem", fontWeight: "600", margin: "0 0 0.5rem 0" }}>
              待機中...
            </p>
            <p style={{ fontSize: "1.1rem", margin: 0, color: "#22c55e" }}>
              ● {monitorName}
            </p>
          </div>
        )}
        </div>

        {/* タイマー: カンペの下・画面下中央にでっかく表示 */}
        {visibleTimers.length > 0 && (
          <div
            style={{
              flexShrink: 0,
              width: "100%",
              padding: "2rem 1.5rem",
              textAlign: "center",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.5rem",
                padding: "2rem 3rem",
                borderRadius: "20px",
                backgroundColor: "var(--card-bg)",
                border: "4px solid var(--card-border)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
              }}
            >
              <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-color)" }}>
                ⏱ {visibleTimers.length > 1 ? "タイマー" : visibleTimers[0].definition.name}
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "2rem" }}>
                {visibleTimers.map((entry) => {
                  const totalSeconds = Math.max(0, Math.floor(entry.runtime.remaining_ms / 1000));
                  const hours = Math.floor(totalSeconds / 3600);
                  const minutes = Math.floor((totalSeconds % 3600) / 60);
                  const seconds = totalSeconds % 60;
                  const pad = (n: number) => n.toString().padStart(2, "0");
                  const timeStr = hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
                  return (
                    <div key={entry.definition.id} style={{ textAlign: "center" }}>
                      {visibleTimers.length > 1 && (
                        <div style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.25rem", color: "var(--text-color)" }}>
                          {entry.definition.name}
                        </div>
                      )}
                      <div
                        style={{
                          fontVariantNumeric: "tabular-nums",
                          fontSize: "5rem",
                          fontWeight: 800,
                          color: "var(--accent-color)",
                          lineHeight: 1.1,
                          letterSpacing: "0.02em",
                        }}
                      >
                        {timeStr}
                      </div>
                      <div style={{ fontSize: "1.1rem", color: "var(--muted-text)", fontWeight: 600 }}>
                        {formatTimerStateLabel(entry.runtime.state)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Feedback Toggle Button (fixed top-right) */}
        <button
          onClick={() => setShowFeedbackPanel(!showFeedbackPanel)}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            padding: "0.75rem 1.25rem",
            fontSize: "1rem",
            fontWeight: "600",
            backgroundColor: showFeedbackPanel ? "#ef4444" : "var(--accent-color)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            transition: "all 0.2s ease",
            zIndex: 1000,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          {showFeedbackPanel ? "✕ 閉じる" : "💬 フィードバック"}
        </button>

        {/* Controls (fixed top-left) */}
        <div
          style={{
            position: "absolute",
            top: "1rem",
            left: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            zIndex: 1000,
          }}
        >
          {/* Font Size Controls */}
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
              backgroundColor: "var(--card-bg)",
              opacity: 0.95,
              padding: "0.75rem",
              borderRadius: "8px",
              border: "1px solid var(--card-border)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
          >
            <button
              onClick={() => setFontSize(Math.max(1, fontSize - 0.5))}
              style={{
                padding: "0.5rem 0.75rem",
                fontSize: "1rem",
                fontWeight: "600",
                backgroundColor: "var(--accent-color)",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              A-
            </button>
            <span style={{ fontSize: "0.9rem", fontWeight: "600", color: "var(--text-color)" }}>
              {fontSize}rem
            </span>
            <button
              onClick={() => setFontSize(Math.min(8, fontSize + 0.5))}
              style={{
                padding: "0.5rem 0.75rem",
                fontSize: "1rem",
                fontWeight: "600",
                backgroundColor: "var(--accent-color)",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              A+
            </button>
          </div>

          {/* Theme Toggle */}
          <div style={{ opacity: 0.95 }}>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Feedback Panel (sliding from bottom) */}
      {showFeedbackPanel && (
        <div
          style={{
            backgroundColor: "var(--secondary-bg)",
            borderTop: "2px solid var(--accent-color)",
            display: "flex",
            flexDirection: "column",
            maxHeight: "50vh",
            animation: "slideUp 0.3s ease-out",
          }}
        >
          {/* Tab Buttons */}
          <div style={{ display: "flex", borderBottom: "2px solid var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <button
              onClick={() => setActiveTab("reply")}
              disabled={!currentMessage}
              style={{
                flex: 1,
                padding: "1rem",
                fontSize: "1rem",
                fontWeight: "600",
                backgroundColor: activeTab === "reply" ? "var(--accent-color)" : "transparent",
                color: activeTab === "reply" ? "#fff" : currentMessage ? "var(--text-color)" : "var(--muted-text)",
                border: "none",
                borderBottom: activeTab === "reply" ? "3px solid var(--accent-color)" : "3px solid transparent",
                cursor: currentMessage ? "pointer" : "not-allowed",
                transition: "all 0.2s ease",
                opacity: currentMessage ? 1 : 0.5,
              }}
            >
              📝 メッセージへの返信
            </button>
            <button
              onClick={() => setActiveTab("new")}
              style={{
                flex: 1,
                padding: "1rem",
                fontSize: "1rem",
                fontWeight: "600",
                backgroundColor: activeTab === "new" ? "var(--accent-color)" : "transparent",
                color: activeTab === "new" ? "#fff" : "var(--text-color)",
                border: "none",
                borderBottom: activeTab === "new" ? "3px solid var(--accent-color)" : "3px solid transparent",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              ✉️ 新規メッセージ
            </button>
            <button
              onClick={() => setActiveTab("template")}
              style={{
                flex: 1,
                padding: "1rem",
                fontSize: "1rem",
                fontWeight: "600",
                backgroundColor: activeTab === "template" ? "var(--accent-color)" : "transparent",
                color: activeTab === "template" ? "#fff" : "var(--text-color)",
                border: "none",
                borderBottom: activeTab === "template" ? "3px solid var(--accent-color)" : "3px solid transparent",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              📋 テンプレート
            </button>
          </div>

          {/* Tab Content */}
          <div
            className="scrollable"
            style={{
              padding: "1.5rem",
              overflowY: "auto",
              flex: 1,
            }}
          >
            {/* Reply Tab */}
            {activeTab === "reply" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {!currentMessage ? (
                  <div
                    style={{
                      padding: "2rem",
                      backgroundColor: "rgba(255, 193, 7, 0.1)",
                      border: "2px solid #ffc107",
                      borderRadius: "8px",
                      color: "#ffc107",
                      fontWeight: "600",
                      textAlign: "center",
                    }}
                  >
                    ⚠ メッセージを受信していないため、返信できません。<br />
                    新規メッセージタブをご利用ください。
                  </div>
                ) : templates.config && templates.config.client_templates.length > 0 ? (
                  <>
                    <h4 style={{ margin: 0, color: "var(--text-color)", fontSize: "1rem" }}>
                      テンプレートを選択して返信:
                    </h4>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem" }}>
                      {templates.config.client_templates.map((template) => {
                        const typeInfo = FEEDBACK_TYPE_COLORS[template.feedback_type];

                        return (
                          <button
                            key={template.id}
                            onClick={() => handleTemplateClick(template)}
                            disabled={isSendingFeedback}
                            style={{
                              padding: "1rem",
                              textAlign: "left",
                              backgroundColor: "var(--card-bg)",
                              border: `2px solid ${typeInfo.bg}`,
                              borderRadius: "8px",
                              cursor: isSendingFeedback ? "not-allowed" : "pointer",
                              transition: "all 0.2s ease",
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.5rem",
                            }}
                            onMouseEnter={(e) => {
                              if (!isSendingFeedback) {
                                e.currentTarget.style.backgroundColor = "var(--secondary-bg)";
                                e.currentTarget.style.transform = "translateY(-2px)";
                                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "var(--card-bg)";
                              e.currentTarget.style.transform = "translateY(0)";
                              e.currentTarget.style.boxShadow = "none";
                            }}
                          >
                            <span
                              style={{
                                fontSize: "0.75rem",
                                fontWeight: "600",
                                color: "#fff",
                                backgroundColor: typeInfo.bg,
                                padding: "0.25rem 0.5rem",
                                borderRadius: "4px",
                                alignSelf: "flex-start",
                              }}
                            >
                              {typeInfo.label}
                            </span>
                            <span style={{ fontSize: "0.95rem", fontWeight: "600", color: "var(--text-color)" }}>
                              {template.content}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      padding: "2rem",
                      backgroundColor: "var(--secondary-bg)",
                      border: "2px solid var(--card-border)",
                      borderRadius: "8px",
                      color: "var(--muted-text)",
                      textAlign: "center",
                    }}
                  >
                    テンプレートが登録されていません。<br />
                    「テンプレート」タブから追加してください。
                  </div>
                )}
              </div>
            )}

            {/* New Message Tab */}
            {activeTab === "new" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {templates.config && templates.config.client_templates.length > 0 ? (
                  <>
                    <h4 style={{ margin: 0, color: "var(--text-color)", fontSize: "1rem" }}>
                      テンプレートを選択して新規メッセージを送信:
                    </h4>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem" }}>
                      {templates.config.client_templates.map((template) => {
                        const typeInfo = FEEDBACK_TYPE_COLORS[template.feedback_type];

                        return (
                          <button
                            key={template.id}
                            onClick={() => handleTemplateClick(template)}
                            disabled={isSendingFeedback}
                            style={{
                              padding: "1rem",
                              textAlign: "left",
                              backgroundColor: "var(--card-bg)",
                              border: `2px solid ${typeInfo.bg}`,
                              borderRadius: "8px",
                              cursor: isSendingFeedback ? "not-allowed" : "pointer",
                              transition: "all 0.2s ease",
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.5rem",
                            }}
                            onMouseEnter={(e) => {
                              if (!isSendingFeedback) {
                                e.currentTarget.style.backgroundColor = "var(--secondary-bg)";
                                e.currentTarget.style.transform = "translateY(-2px)";
                                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "var(--card-bg)";
                              e.currentTarget.style.transform = "translateY(0)";
                              e.currentTarget.style.boxShadow = "none";
                            }}
                          >
                            <span
                              style={{
                                fontSize: "0.75rem",
                                fontWeight: "600",
                                color: "#fff",
                                backgroundColor: typeInfo.bg,
                                padding: "0.25rem 0.5rem",
                                borderRadius: "4px",
                                alignSelf: "flex-start",
                              }}
                            >
                              {typeInfo.label}
                            </span>
                            <span style={{ fontSize: "0.95rem", fontWeight: "600", color: "var(--text-color)" }}>
                              {template.content}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      padding: "2rem",
                      backgroundColor: "var(--secondary-bg)",
                      border: "2px solid var(--card-border)",
                      borderRadius: "8px",
                      color: "var(--muted-text)",
                      textAlign: "center",
                    }}
                  >
                    テンプレートが登録されていません。<br />
                    「テンプレート」タブから追加してください。
                  </div>
                )}
              </div>
            )}

            {/* Template Management Tab */}
            {activeTab === "template" && templates.config && (
              <div>
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
            )}
          </div>

          {/* Status Message */}
          {feedbackSent && (
            <div
              style={{
                padding: "1rem",
                backgroundColor: "#22c55e",
                color: "white",
                textAlign: "center",
                fontWeight: "600",
                fontSize: "1rem",
              }}
            >
              ✓ 送信完了
            </div>
          )}
        </div>
      )}

      {/* CSS for flash animation, spinner, and slide animations */}
      <style>{`
        @keyframes flash {
          0%, 100% { background-color: inherit; }
          25%, 75% { background-color: #ff0000; }
          50% { background-color: inherit; }
        }
        .flash-animation {
          animation: flash 0.5s ease-in-out 3;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spinner {
          display: inline-block;
          animation: spin 0.8s linear infinite;
        }
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
