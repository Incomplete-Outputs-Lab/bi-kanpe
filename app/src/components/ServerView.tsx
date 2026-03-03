import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useServerState } from "../hooks/useServerState";
import { useTemplates } from "../hooks/useTemplates";
import { useToast } from "../hooks/useToast";
import { TemplateManager } from "./TemplateManager";
import { ThemeToggle } from "./ThemeToggle";
import { ConfirmDialog } from "./ConfirmDialog";
import { QRCodeSVG } from "qrcode.react";
import type {
  Message,
  Priority,
  ServerTemplate,
  TimerEntry,
  TimerState,
} from "../types/messages";

// Hoist static priority options to avoid recreation on every render
const PRIORITY_OPTIONS = [
  { value: "normal", label: "通常", emoji: "📝", color: "#333", bg: "#f0f0f0", desc: "通常のメッセージ" },
  { value: "high", label: "重要", emoji: "⚠", color: "#ff8800", bg: "#ffeecc", desc: "注意が必要" },
  { value: "urgent", label: "緊急", emoji: "🚨", color: "#ff0000", bg: "#ffcccc", desc: "即座の対応が必要" },
] as const;

interface ServerViewProps {
  onBackToMenu: () => void;
}

export function ServerView({ onBackToMenu }: ServerViewProps) {
  const serverState = useServerState();
  const templates = useTemplates();
  const { showToast } = useToast();
  const [port, setPort] = useState<number>(9876);
  const [messageContent, setMessageContent] = useState<string>("");
  const [targetMonitorIds, setTargetMonitorIds] = useState<string[]>(["ALL"]);
  const [priority, setPriority] = useState<Priority>("normal");
  const [error, setError] = useState<string | null>(null);
  const [showMonitorManagement, setShowMonitorManagement] = useState<boolean>(false);
  const [showTemplateManagement, setShowTemplateManagement] = useState<boolean>(false);
  const [newMonitorName, setNewMonitorName] = useState<string>("");
  const [newMonitorDescription, setNewMonitorDescription] = useState<string>("");
  const [newMonitorColor, setNewMonitorColor] = useState<string>("#667eea");
  const [isSendingMessage, setIsSendingMessage] = useState<boolean>(false);
  const [messageSent, setMessageSent] = useState<boolean>(false);
  const [isSendingFlash, setIsSendingFlash] = useState<boolean>(false);
  const [flashSent, setFlashSent] = useState<boolean>(false);
  const [isSendingClear, setIsSendingClear] = useState<boolean>(false);
  const [clearSent, setClearSent] = useState<boolean>(false);
  const [serverAddresses, setServerAddresses] = useState<string[]>([]);
  const [showQRCode, setShowQRCode] = useState<boolean>(false);
  const [showAllAddresses, setShowAllAddresses] = useState<boolean>(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    message: "",
    onConfirm: () => {},
  });
  const [showTimerManagement, setShowTimerManagement] = useState<boolean>(false);
  const [newTimerName, setNewTimerName] = useState<string>("");
  const [newTimerDurationMinutes, setNewTimerDurationMinutes] = useState<number>(0);
  const [newTimerDurationSeconds, setNewTimerDurationSeconds] = useState<number>(0);
  const [newTimerScheduledTime, setNewTimerScheduledTime] = useState<string>("");
  const [newTimerTargetMonitorIds, setNewTimerTargetMonitorIds] = useState<string[]>(["ALL"]);
  const [isCreatingTimer, setIsCreatingTimer] = useState<boolean>(false);

  const handleBackToMenu = async () => {
    if (serverState.isRunning) {
      setConfirmDialog({
        isOpen: true,
        message: "サーバーが起動中です。停止してメインメニューに戻りますか？",
        onConfirm: async () => {
          setConfirmDialog({ isOpen: false, message: "", onConfirm: () => {} });
          await handleStopServer();
          onBackToMenu();
        },
      });
      return;
    }
    onBackToMenu();
  };

  // Get monitors from server state
  const availableMonitors = serverState.monitors;

  // Current message per monitor (last sent message targeting that monitor or ALL)
  const currentMessagePerMonitor = useMemo(() => {
    const map = new Map<string, Message>();
    for (const monitor of availableMonitors) {
      const last = serverState.sentMessages
        .filter((msg): msg is Message & { type: "kanpe_message" } => {
          if (msg.type !== "kanpe_message") return false;
          const targetIds = msg.payload.target_monitor_ids;
          return targetIds.includes("ALL") || targetIds.includes(monitor.id);
        })
        .slice(-1)[0];
      if (last) map.set(monitor.id, last);
    }
    return map;
  }, [serverState.sentMessages, availableMonitors]);

  const getPriorityColor = (p: string) => (p === "urgent" ? "#ff0000" : p === "high" ? "#ff8800" : "var(--text-color)");
  const getPriorityBackgroundColor = (p: string) => (p === "urgent" ? "rgba(255, 0, 0, 0.1)" : p === "high" ? "rgba(255, 136, 0, 0.1)" : "var(--card-bg)");

  // Memoize feedback type emoji mapping
  const feedbackTypeEmoji = useMemo(() => ({
    ack: "✓",
    question: "?",
    issue: "⚠",
    info: "ℹ",
  }), []);

  // Memoize priority color mapping
  const priorityColor = useMemo(() => ({
    urgent: "#ff0000",
    high: "#ff8800",
    normal: "var(--text-color)",
  }), []);

  // Memoize new feedbacks (not replies to messages)
  const newFeedbacks = useMemo(() => {
    return serverState.feedbackMessages.filter(
      fb => fb.type === "feedback_message" && !fb.payload.reply_to_message_id
    );
  }, [serverState.feedbackMessages]);

  // Memoize messages with their associated feedbacks
  const messagesWithFeedback = useMemo(() => {
    return serverState.sentMessages
      .slice()
      .reverse()
      .map((msg) => {
        if (msg.type !== "kanpe_message") return null;

        const feedbacks = serverState.feedbackMessages.filter(
          (fb) => fb.type === "feedback_message" && fb.payload.reply_to_message_id === msg.id
        );

        return { msg, feedbacks };
      })
      .filter(Boolean);
  }, [serverState.sentMessages, serverState.feedbackMessages]);

  const timers: TimerEntry[] = serverState.timers?.timers ?? [];

  const formatDuration = (remainingMs: number) => {
    const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const formatTimerStateLabel = (state: TimerState) => {
    switch (state) {
      case "running":
        return "▶ 進行中";
      case "paused":
        return "⏸ 一時停止";
      case "completed":
        return "✓ 完了";
      case "cancelled":
        return "✕ 中止";
      case "pending":
      default:
        return "待機中";
    }
  };

  const toggleTimerTargetMonitorId = (id: string) => {
    if (id === "ALL") {
      setNewTimerTargetMonitorIds(["ALL"]);
    } else {
      setNewTimerTargetMonitorIds((prev) => {
        const base = prev.filter((v) => v !== "ALL");
        return base.includes(id)
          ? base.filter((v) => v !== id)
          : [...base, id];
      });
    }
  };

  const handleCreateTimer = async () => {
    if (!newTimerName.trim()) {
      setError("タイマー名を入力してください");
      return;
    }
    const durationMs =
      Math.max(0, newTimerDurationMinutes) * 60_000 +
      Math.max(0, newTimerDurationSeconds) * 1_000;
    if (durationMs <= 0) {
      setError("タイマーの長さを1秒以上にしてください");
      return;
    }

    let scheduledStartTimestampMs: number | null = null;
    if (newTimerScheduledTime) {
      const [hh, mm] = newTimerScheduledTime.split(":").map((v) => parseInt(v, 10));
      if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
        const now = new Date();
        const scheduled = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          hh,
          mm,
          0,
          0
        );
        scheduledStartTimestampMs = scheduled.getTime();
      }
    }

    const targets =
      newTimerTargetMonitorIds.length === 0 ? ["ALL"] : newTimerTargetMonitorIds;

    try {
      setError(null);
      setIsCreatingTimer(true);
      const id =
        (globalThis.crypto && "randomUUID" in globalThis.crypto
          ? (globalThis.crypto as Crypto).randomUUID()
          : `timer-${Date.now()}-${Math.random().toString(16).slice(2)}`);

      await invoke("create_timer", {
        id,
        name: newTimerName,
        targetMonitorIds: targets,
        durationMs: durationMs,
        scheduledStartTimestampMs,
      });

      setNewTimerName("");
      setNewTimerDurationMinutes(0);
      setNewTimerDurationSeconds(0);
      setNewTimerScheduledTime("");
      setNewTimerTargetMonitorIds(["ALL"]);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsCreatingTimer(false);
    }
  };

  const handleTimerAction = async (timerId: string, action: "start" | "pause" | "resume" | "stop") => {
    try {
      setError(null);
      const command =
        action === "start"
          ? { kind: "start", timer_id: timerId }
          : action === "pause"
          ? { kind: "pause", timer_id: timerId }
          : action === "resume"
          ? { kind: "resume", timer_id: timerId }
          : { kind: "stop", timer_id: timerId, cancelled: false };

      await invoke("send_timer_command", { command });
    } catch (err) {
      setError(String(err));
    }
  };

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
      setServerAddresses([]);
    } catch (err) {
      setError(String(err));
    }
  };

  // Fetch server addresses when server is running
  useEffect(() => {
    if (serverState.isRunning) {
      invoke<string[]>("get_server_addresses")
        .then((addresses) => {
          setServerAddresses(addresses);
        })
        .catch((err) => {
          console.error("Failed to get server addresses:", err);
        });
    } else {
      setServerAddresses([]);
    }
  }, [serverState.isRunning]);

  const handleSendMessage = async () => {
    if (!messageContent.trim()) {
      setError("Message content cannot be empty");
      return;
    }

    try {
      setError(null);
      setIsSendingMessage(true);
      await invoke("send_kanpe_message", {
        targetMonitorIds,
        content: messageContent,
        priority,
      });
      setMessageContent("");
      setMessageSent(true);
      setTimeout(() => setMessageSent(false), 1500);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleSendFlash = async () => {
    try {
      setError(null);
      setIsSendingFlash(true);
      await invoke("send_flash_command", {
        targetMonitorIds,
      });
      setFlashSent(true);
      setTimeout(() => setFlashSent(false), 1500);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSendingFlash(false);
    }
  };

  const handleSendClear = async () => {
    try {
      setError(null);
      setIsSendingClear(true);
      await invoke("send_clear_command", {
        targetMonitorIds,
      });
      setClearSent(true);
      setTimeout(() => setClearSent(false), 1500);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSendingClear(false);
    }
  };

  const toggleMonitorId = (id: string) => {
    if (id === "ALL") {
      // If "All" is selected, clear other selections
      setTargetMonitorIds(["ALL"]);
    } else {
      setTargetMonitorIds((prev) => {
        const newIds = prev.filter((i) => i !== "ALL"); // Remove "All" if specific ID selected
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

  const handleRemoveMonitor = async (monitorId: string) => {
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
    <div style={{ padding: "1rem", display: "flex", gap: "1rem", height: "100vh", backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}>
      {/* Left Panel - Server Controls and Message Input */}
      <div className="scrollable" style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1rem", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: "1.8rem", color: "var(--accent-color)" }}>
            🎬 カンペモード
          </h2>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <ThemeToggle />
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
        </div>

        {/* Server Controls */}
        <div
          style={{
            border: "1px solid var(--card-border)",
            padding: "1rem",
            borderRadius: "8px",
            backgroundColor: "var(--card-bg)",
          }}
        >
          <h3 style={{ marginTop: 0, color: "var(--text-color)" }}>サーバー制御</h3>
          {!serverState.isRunning ? (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ fontWeight: "600", color: "var(--text-color)" }}>ポート番号:</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                style={{
                  width: "120px",
                  padding: "0.5rem",
                  borderRadius: "4px",
                  border: "1px solid var(--input-border)",
                  backgroundColor: "var(--input-bg)",
                  color: "var(--input-text)",
                  fontSize: "1rem",
                }}
              />
              <button
                onClick={handleStartServer}
                style={{
                  padding: "0.5rem 1.5rem",
                  fontSize: "1rem",
                  fontWeight: "600",
                  backgroundColor: "var(--accent-color)",
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
                {" - "}<span style={{ color: "var(--text-color)" }}>ポート</span> <strong style={{ fontSize: "1.1rem", color: "var(--text-color)" }}>{serverState.port}</strong>
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
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
                  onClick={() => setShowTimerManagement(!showTimerManagement)}
                  style={{
                    padding: "0.5rem 1.5rem",
                    fontSize: "1rem",
                    fontWeight: "600",
                    backgroundColor: showTimerManagement ? "#6b7280" : "#0ea5e9",
                    color: "white",
                    border: showTimerManagement ? "2px solid #0ea5e9" : "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  ⏱ タイマー管理
                </button>
                <button
                  onClick={() => setShowMonitorManagement(!showMonitorManagement)}
                  style={{
                    padding: "0.5rem 1.5rem",
                    fontSize: "1rem",
                    fontWeight: "600",
                    backgroundColor: showMonitorManagement ? "#6b7280" : "#8b5cf6",
                    color: "white",
                    border: showMonitorManagement ? "2px solid #8b5cf6" : "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  {showMonitorManagement ? "📺 モニター管理 ▼" : "📺 モニター管理"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Web接続情報 */}
        {serverState.isRunning && serverAddresses.length > 0 && (
          <div
            style={{
              border: "2px solid var(--accent-color)",
              padding: "1rem",
              borderRadius: "8px",
              backgroundColor: "var(--card-bg)",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "0.75rem", color: "var(--text-color)", fontSize: "1rem" }}>
              📱 Web キャスター接続
            </h3>
            <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.9rem", color: "var(--muted-text)" }}>
              スマホやタブレットのブラウザから以下のURLにアクセス
            </p>
            
            {/* Primary Address */}
            <div 
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.5rem",
                padding: "0.5rem",
                backgroundColor: "var(--secondary-bg)",
                borderRadius: "4px",
              }}
            >
              <code style={{ 
                flex: 1, 
                fontSize: "0.9rem", 
                color: "var(--accent-color)",
                fontWeight: "600",
              }}>
                {serverAddresses[0]}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(serverAddresses[0]);
                  showToast('URLをコピーしました', 'success');
                }}
                style={{
                  padding: "0.25rem 0.75rem",
                  fontSize: "0.85rem",
                  backgroundColor: "var(--accent-color)",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                📋 コピー
              </button>
            </div>

            {/* Additional Addresses (collapsible) */}
            {serverAddresses.length > 1 && (
              <>
                <button
                  onClick={() => setShowAllAddresses(!showAllAddresses)}
                  style={{
                    padding: "0.5rem 1rem",
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    backgroundColor: "var(--secondary-bg)",
                    color: "var(--text-color)",
                    border: "1px solid var(--card-border)",
                    borderRadius: "4px",
                    cursor: "pointer",
                    marginBottom: "0.5rem",
                    width: "100%",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span>{showAllAddresses ? "▼" : "▶"}</span>
                  <span>他のアドレスを{showAllAddresses ? "隠す" : "表示"} ({serverAddresses.length - 1}個)</span>
                </button>
                
                {showAllAddresses && serverAddresses.slice(1).map((address, index) => (
                  <div 
                    key={index}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.5rem",
                      padding: "0.5rem",
                      backgroundColor: "var(--secondary-bg)",
                      borderRadius: "4px",
                      marginLeft: "1rem",
                    }}
                  >
                    <code style={{ 
                      flex: 1, 
                      fontSize: "0.85rem", 
                      color: "var(--text-color)",
                      fontWeight: "500",
                    }}>
                      {address}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(address);
                        showToast('URLをコピーしました', 'success');
                      }}
                      style={{
                        padding: "0.25rem 0.75rem",
                        fontSize: "0.85rem",
                        backgroundColor: "var(--accent-color)",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      📋 コピー
                    </button>
                  </div>
                ))}
              </>
            )}
            
            <button
              onClick={() => setShowQRCode(!showQRCode)}
              style={{
                marginTop: "0.5rem",
                padding: "0.5rem 1rem",
                fontSize: "0.9rem",
                fontWeight: "600",
                backgroundColor: showQRCode ? "#6b7280" : "var(--accent-color)",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              {showQRCode ? "📱 QRコードを隠す" : "📱 QRコードを表示"}
            </button>
            
            {showQRCode && serverAddresses[0] && (
              <div style={{ 
                marginTop: "1rem", 
                padding: "1rem",
                backgroundColor: "white",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "center",
              }}>
                <QRCodeSVG 
                  value={serverAddresses[0]} 
                  size={200}
                  level="M"
                  includeMargin={true}
                />
              </div>
            )}
          </div>
        )}

        {/* 現在表示中のカンペ（モニターごと） */}
        {serverState.isRunning && availableMonitors.length > 0 && (
          <div
            style={{
              border: "1px solid var(--card-border)",
              padding: "1rem",
              borderRadius: "8px",
              backgroundColor: "var(--card-bg)",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "0.75rem", color: "var(--text-color)", fontSize: "1rem" }}>
              現在表示中のカンペ
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "0.75rem",
              }}
            >
              {availableMonitors.map((monitor) => {
                const msg = currentMessagePerMonitor.get(monitor.id);
                const priority = msg?.type === "kanpe_message" ? msg.payload.priority : "normal";
                const bgColor =
                  msg?.type === "kanpe_message"
                    ? getPriorityBackgroundColor(msg.payload.priority)
                    : "var(--card-bg)";
                return (
                  <div
                    key={monitor.id}
                    style={{
                      padding: "1rem",
                      borderRadius: "6px",
                      backgroundColor: bgColor,
                      border: "1px solid var(--card-border)",
                      borderLeft: monitor.color ? `4px solid ${monitor.color}` : "4px solid var(--card-border)",
                      minHeight: "4rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: "600", color: "var(--text-color)", fontSize: "0.95rem" }}>
                        {monitor.name}
                      </span>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          color: msg ? getPriorityColor(priority) : "var(--muted-text)",
                        }}
                      >
                        {msg?.type === "kanpe_message"
                          ? msg.payload.priority === "urgent"
                            ? "🚨 緊急"
                            : msg.payload.priority === "high"
                              ? "⚠ 重要"
                              : "📝 通常"
                          : "待機中"}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.95rem",
                        color: msg?.type === "kanpe_message" ? getPriorityColor(priority) : "var(--muted-text)",
                        whiteSpace: "pre-wrap",
                        lineHeight: "1.3",
                        flex: 1,
                      }}
                    >
                      {msg?.type === "kanpe_message" ? msg.payload.content : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", color: "var(--muted-text)", fontStyle: "italic" }}>
              各モニターに送信した直近のカンペ内容です
            </p>
          </div>
        )}

        {/* Timer Management Panel */}
        {serverState.isRunning && showTimerManagement ? (
          <div
            style={{
              border: "2px solid #0ea5e9",
              padding: "1.5rem",
              borderRadius: "8px",
              backgroundColor: "var(--card-bg)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: "#0ea5e9",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                ⏱ タイマー管理
              </h3>
              <button
                onClick={() => setShowTimerManagement(false)}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.9rem",
                  fontWeight: "600",
                  backgroundColor: "#6b7280",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                ✕ 閉じる
              </button>
            </div>

            {/* New Timer Form */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                padding: "1rem",
                backgroundColor: "var(--secondary-bg)",
                borderRadius: "6px",
                marginBottom: "1rem",
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: "0.95rem",
                  color: "var(--text-color)",
                }}
              >
                ➕ 新しいタイマー
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    color: "var(--text-color)",
                  }}
                >
                  タイマー名
                </label>
                <input
                  type="text"
                  value={newTimerName}
                  onChange={(e) => setNewTimerName(e.target.value)}
                  placeholder="例: オープニング、コーナー1"
                  style={{
                    padding: "0.5rem",
                    borderRadius: "4px",
                    border: "1px solid var(--card-border)",
                    backgroundColor: "var(--bg-color)",
                    color: "var(--text-color)",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <label
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: "600",
                      color: "var(--text-color)",
                    }}
                  >
                    長さ
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    <input
                      type="number"
                      min={0}
                      value={newTimerDurationMinutes}
                      onChange={(e) =>
                        setNewTimerDurationMinutes(parseInt(e.target.value || "0", 10))
                      }
                      style={{
                        width: "70px",
                        padding: "0.4rem",
                        borderRadius: "4px",
                        border: "1px solid var(--card-border)",
                        backgroundColor: "var(--bg-color)",
                        color: "var(--text-color)",
                      }}
                    />
                    <span style={{ fontSize: "0.85rem" }}>分</span>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={newTimerDurationSeconds}
                      onChange={(e) =>
                        setNewTimerDurationSeconds(
                          Math.min(59, parseInt(e.target.value || "0", 10))
                        )
                      }
                      style={{
                        width: "70px",
                        padding: "0.4rem",
                        borderRadius: "4px",
                        border: "1px solid var(--card-border)",
                        backgroundColor: "var(--bg-color)",
                        color: "var(--text-color)",
                      }}
                    />
                    <span style={{ fontSize: "0.85rem" }}>秒</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <label
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: "600",
                      color: "var(--text-color)",
                    }}
                  >
                    自動開始時刻（任意）
                  </label>
                  <input
                    type="time"
                    value={newTimerScheduledTime}
                    onChange={(e) => setNewTimerScheduledTime(e.target.value)}
                    style={{
                      padding: "0.4rem",
                      borderRadius: "4px",
                      border: "1px solid var(--card-border)",
                      backgroundColor: "var(--bg-color)",
                      color: "var(--text-color)",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    color: "var(--text-color)",
                  }}
                >
                  対象モニター
                </label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                    gap: "0.5rem",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.5rem",
                      borderRadius: "4px",
                      cursor: "pointer",
                      backgroundColor: newTimerTargetMonitorIds.includes("ALL")
                        ? "var(--accent-color)"
                        : "var(--secondary-bg)",
                      color: newTimerTargetMonitorIds.includes("ALL")
                        ? "white"
                        : "var(--text-color)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={newTimerTargetMonitorIds.includes("ALL")}
                      onChange={() => toggleTimerTargetMonitorId("ALL")}
                      style={{ cursor: "pointer" }}
                    />
                    すべて
                  </label>
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
                        backgroundColor: newTimerTargetMonitorIds.includes(monitor.id)
                          ? "var(--accent-color)"
                          : "var(--secondary-bg)",
                        color: newTimerTargetMonitorIds.includes(monitor.id)
                          ? "white"
                          : "var(--text-color)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={newTimerTargetMonitorIds.includes(monitor.id)}
                        onChange={() => toggleTimerTargetMonitorId(monitor.id)}
                        style={{ cursor: "pointer" }}
                      />
                      {monitor.name}
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCreateTimer}
                disabled={isCreatingTimer}
                style={{
                  padding: "0.75rem 1.5rem",
                  fontSize: "1rem",
                  fontWeight: "600",
                  backgroundColor: isCreatingTimer ? "#9ca3af" : "#0ea5e9",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: isCreatingTimer ? "not-allowed" : "pointer",
                  alignSelf: "flex-start",
                }}
              >
                {isCreatingTimer ? "作成中..." : "➕ タイマーを追加"}
              </button>
            </div>

            {/* Timer List */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <h4
                style={{
                  margin: "0 0 0.5rem 0",
                  fontSize: "0.95rem",
                  color: "var(--text-color)",
                }}
              >
                登録済みタイマー ({timers.length}個)
              </h4>
              <div
                className="scrollable"
                style={{
                  maxHeight: "260px",
                  overflowY: "auto",
                  padding: "0.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                {timers.length === 0 ? (
                  <div
                    style={{
                      padding: "1rem",
                      textAlign: "center",
                      color: "var(--muted-text)",
                      fontStyle: "italic",
                    }}
                  >
                    まだタイマーが登録されていません
                  </div>
                ) : (
                  timers.map((entry) => {
                    const { definition, runtime } = entry;
                    const isRunning = runtime.state === "running";
                    const isPaused = runtime.state === "paused";
                    const isCompleted = runtime.state === "completed";
                    const isCancelled = runtime.state === "cancelled";
                    const isPending = runtime.state === "pending";
                    const targetsLabel = definition.target_monitor_ids.includes("ALL")
                      ? "全て"
                      : definition.target_monitor_ids.join(", ");

                    return (
                      <div
                        key={definition.id}
                        style={{
                          padding: "0.75rem",
                          borderRadius: "6px",
                          backgroundColor: "var(--bg-color)",
                          border: "1px solid var(--card-border)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.3rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: "600",
                              color: "var(--text-color)",
                            }}
                          >
                            {definition.name}
                          </div>
                          <div
                            style={{
                              fontSize: "0.8rem",
                              padding: "0.15rem 0.5rem",
                              borderRadius: "999px",
                              backgroundColor: "var(--secondary-bg)",
                              color: "var(--text-color)",
                            }}
                          >
                            {formatTimerStateLabel(runtime.state)}
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "0.85rem",
                            color: "var(--muted-text)",
                          }}
                        >
                          <span>残り: {formatDuration(runtime.remaining_ms)}</span>
                          <span>対象: {targetsLabel}</span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "0.25rem",
                            marginTop: "0.25rem",
                          }}
                        >
                          <button
                            onClick={() => handleTimerAction(definition.id, "start")}
                            disabled={isRunning}
                            style={{
                              padding: "0.3rem 0.75rem",
                              fontSize: "0.8rem",
                              borderRadius: "4px",
                              border: "none",
                              backgroundColor: isRunning ? "#d1d5db" : "#22c55e",
                              color: "white",
                              cursor: isRunning ? "not-allowed" : "pointer",
                            }}
                          >
                            ▶ スタート
                          </button>
                          <button
                            onClick={() => handleTimerAction(definition.id, "pause")}
                            disabled={!isRunning}
                            style={{
                              padding: "0.3rem 0.75rem",
                              fontSize: "0.8rem",
                              borderRadius: "4px",
                              border: "none",
                              backgroundColor: !isRunning ? "#d1d5db" : "#f59e0b",
                              color: "white",
                              cursor: !isRunning ? "not-allowed" : "pointer",
                            }}
                          >
                            ⏸ 一時停止
                          </button>
                          <button
                            onClick={() => handleTimerAction(definition.id, "resume")}
                            disabled={!isPaused}
                            style={{
                              padding: "0.3rem 0.75rem",
                              fontSize: "0.8rem",
                              borderRadius: "4px",
                              border: "none",
                              backgroundColor: !isPaused ? "#d1d5db" : "#3b82f6",
                              color: "white",
                              cursor: !isPaused ? "not-allowed" : "pointer",
                            }}
                          >
                            ▶ 再開
                          </button>
                          <button
                            onClick={() => handleTimerAction(definition.id, "stop")}
                            disabled={isCompleted || isCancelled || isPending}
                            style={{
                              padding: "0.3rem 0.75rem",
                              fontSize: "0.8rem",
                              borderRadius: "4px",
                              border: "none",
                              backgroundColor:
                                isCompleted || isCancelled || isPending
                                  ? "#d1d5db"
                                  : "#ef4444",
                              color: "white",
                              cursor:
                                isCompleted || isCancelled || isPending
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          >
                            ⏹ 停止
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Monitor Management Panel */}
        {serverState.isRunning && showMonitorManagement ? (
          <div
            style={{
              border: "2px solid #8b5cf6",
              padding: "1.5rem",
              borderRadius: "8px",
              backgroundColor: "var(--card-bg)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, color: "#8b5cf6", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                📺 仮想モニター管理
              </h3>
              <button
                onClick={() => setShowMonitorManagement(false)}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.9rem",
                  fontWeight: "600",
                  backgroundColor: "#6b7280",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                ✕ 閉じる
              </button>
            </div>

            {/* Add Monitor Form */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              padding: "1rem",
              backgroundColor: "var(--secondary-bg)",
              borderRadius: "6px",
              marginBottom: "1rem",
            }}>
              <h4 style={{ margin: 0, fontSize: "0.95rem", color: "var(--text-color)" }}>➕ 新しいモニターを追加</h4>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-color)" }}>
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
                    border: "1px solid var(--card-border)",
                    backgroundColor: "var(--bg-color)",
                    color: "var(--text-color)",
                    fontSize: "1rem",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-color)" }}>
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
                    border: "1px solid var(--card-border)",
                    backgroundColor: "var(--bg-color)",
                    color: "var(--text-color)",
                    fontSize: "1rem",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flex: "0 0 auto" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-color)" }}>
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
                      border: "1px solid var(--card-border)",
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
                    color: "var(--muted-text)",
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
                        backgroundColor: "var(--bg-color)",
                        border: "2px solid var(--card-border)",
                        borderLeft: monitor.color ? `6px solid ${monitor.color}` : "6px solid var(--card-border)",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontWeight: "700",
                          fontSize: "1rem",
                          color: "var(--text-color)",
                          marginBottom: "0.25rem",
                        }}>
                          📺 {monitor.name}
                          <span style={{
                            marginLeft: "0.5rem",
                            fontSize: "0.85rem",
                            fontWeight: "500",
                            color: "var(--muted-text)",
                            backgroundColor: "var(--secondary-bg)",
                            padding: "0.125rem 0.5rem",
                            borderRadius: "3px",
                          }}>
                            ID: {monitor.id}
                          </span>
                        </div>
                        {monitor.description && (
                          <div style={{
                            fontSize: "0.85rem",
                            color: "var(--muted-text)",
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
              backgroundColor: "var(--card-bg)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, color: "#8b5cf6", fontSize: "1.1rem" }}>
                📝 テンプレート管理
              </h3>
              <button
                onClick={() => setShowTemplateManagement(false)}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.9rem",
                  fontWeight: "600",
                  backgroundColor: "#6b7280",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                ✕ 閉じる
              </button>
            </div>
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
              border: "1px solid var(--card-border)",
              padding: "1rem",
              borderRadius: "8px",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              backgroundColor: "var(--card-bg)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <h3 style={{ margin: 0, color: "var(--text-color)" }}>メッセージ送信</h3>
              <button
                onClick={() => setShowTemplateManagement(!showTemplateManagement)}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.9rem",
                  fontWeight: "600",
                  backgroundColor: showTemplateManagement ? "#6b7280" : "var(--accent-color)",
                  color: "white",
                  border: showTemplateManagement ? "2px solid var(--accent-color)" : "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {showTemplateManagement ? "📝 テンプレート ▼" : "📝 テンプレート"}
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", flex: 1 }}>
              {/* Template Quick Access */}
              {templates.config && templates.config.server_templates.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <label style={{ fontWeight: "600", fontSize: "0.85rem", color: "var(--muted-text)" }}>
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
                          backgroundColor: "var(--secondary-bg)",
                          color: "var(--text-color)",
                          border: "1px solid var(--card-border)",
                          borderRadius: "4px",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "var(--input-bg)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "var(--secondary-bg)";
                        }}
                      >
                        {template.content}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontWeight: "600", fontSize: "0.95rem", color: "var(--text-color)" }}>
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
                    border: "1px solid var(--input-border)",
                    backgroundColor: "var(--input-bg)",
                    color: "var(--input-text)",
                    fontSize: "1rem",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <label style={{ fontWeight: "600", fontSize: "0.95rem", color: "var(--text-color)" }}>
                    送信先モニター:
                  </label>
                  <span
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--muted-text)",
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
                    backgroundColor: "var(--input-bg)",
                    borderRadius: "4px",
                    border: "1px solid var(--input-border)",
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
                      backgroundColor: targetMonitorIds.includes("ALL")
                        ? "var(--accent-color)"
                        : "var(--secondary-bg)",
                      color: targetMonitorIds.includes("ALL") ? "white" : "var(--text-color)",
                      transition: "all 0.2s ease",
                      fontWeight: targetMonitorIds.includes("ALL") ? "600" : "normal",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={targetMonitorIds.includes("ALL")}
                      onChange={() => toggleMonitorId("ALL")}
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
                          ? "var(--accent-color)"
                          : "var(--secondary-bg)",
                        color: targetMonitorIds.includes(monitor.id) ? "white" : "var(--text-color)",
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
                    color: "var(--muted-text)",
                    margin: 0,
                    fontStyle: "italic",
                  }}
                >
                  💡 各キャスターが担当するモニターIDを指定できます。「すべて」を選択すると全モニターに送信されます。
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontWeight: "600", fontSize: "0.95rem", color: "var(--text-color)" }}>
                  優先度:
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {PRIORITY_OPTIONS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setPriority(p.value as Priority)}
                      style={{
                        flex: 1,
                        padding: "0.75rem",
                        borderRadius: "4px",
                        border: priority === p.value ? `2px solid ${p.color}` : "2px solid var(--card-border)",
                        backgroundColor: priority === p.value ? p.bg : "var(--card-bg)",
                        color: priority === p.value ? p.color : "var(--text-color)",
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
                      <span style={{ fontSize: "0.75rem", fontWeight: "normal", color: priority === p.value ? "inherit" : "var(--muted-text)" }}>
                        {p.desc}
                      </span>
                    </button>
                  ))}
                </div>
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--muted-text)",
                    margin: 0,
                    fontStyle: "italic",
                  }}
                >
                  💡 優先度によってキャスター側の表示色と背景色が変わります
                </p>
              </div>

              <button
                onClick={handleSendMessage}
                disabled={!messageContent.trim() || targetMonitorIds.length === 0 || isSendingMessage}
                style={{
                  padding: "1rem",
                  fontSize: "1.1rem",
                  fontWeight: "600",
                  backgroundColor: messageSent ? "#10b981" : (messageContent.trim() && targetMonitorIds.length > 0 && !isSendingMessage ? "#667eea" : "#d1d5db"),
                  color: messageContent.trim() && targetMonitorIds.length > 0 ? "white" : "#6b7280",
                  border: "none",
                  borderRadius: "6px",
                  cursor: messageContent.trim() && targetMonitorIds.length > 0 && !isSendingMessage ? "pointer" : "not-allowed",
                  transition: "all 0.2s ease",
                  marginTop: "auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                }}
              >
                {isSendingMessage ? (
                  <>
                    <span className="spinner" style={{ borderColor: "rgba(255, 255, 255, 0.3)", borderTopColor: "white", width: "1rem", height: "1rem", border: "2px solid", borderRadius: "50%" }}></span>
                    送信中...
                  </>
                ) : messageSent ? (
                  <>
                    ✓ 送信完了
                  </>
                ) : (
                  "📤 メッセージを送信"
                )}
              </button>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={handleSendFlash}
                  disabled={targetMonitorIds.length === 0 || isSendingFlash}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    fontSize: "1rem",
                    fontWeight: "600",
                    backgroundColor: flashSent ? "#10b981" : (targetMonitorIds.length > 0 && !isSendingFlash ? "#f59e0b" : "#d1d5db"),
                    color: targetMonitorIds.length > 0 ? "white" : "#6b7280",
                    border: "none",
                    borderRadius: "6px",
                    cursor: targetMonitorIds.length > 0 && !isSendingFlash ? "pointer" : "not-allowed",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                  }}
                  title="選択したモニターに点滅を送信"
                >
                  {isSendingFlash ? (
                    <>
                      <span className="spinner" style={{ borderColor: "rgba(255, 255, 255, 0.3)", borderTopColor: "white", width: "0.875rem", height: "0.875rem", border: "2px solid", borderRadius: "50%" }}></span>
                      送信中...
                    </>
                  ) : flashSent ? (
                    "✓ 送信完了"
                  ) : (
                    "⚡ 点滅"
                  )}
                </button>
                <button
                  onClick={handleSendClear}
                  disabled={targetMonitorIds.length === 0 || isSendingClear}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    fontSize: "1rem",
                    fontWeight: "600",
                    backgroundColor: clearSent ? "#10b981" : (targetMonitorIds.length > 0 && !isSendingClear ? "#ef4444" : "#d1d5db"),
                    color: targetMonitorIds.length > 0 ? "white" : "#6b7280",
                    border: "none",
                    borderRadius: "6px",
                    cursor: targetMonitorIds.length > 0 && !isSendingClear ? "pointer" : "not-allowed",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                  }}
                  title="選択したモニターの表示をクリア"
                >
                  {isSendingClear ? (
                    <>
                      <span className="spinner" style={{ borderColor: "rgba(255, 255, 255, 0.3)", borderTopColor: "white", width: "0.875rem", height: "0.875rem", border: "2px solid", borderRadius: "50%" }}></span>
                      送信中...
                    </>
                  ) : clearSent ? (
                    "✓ 送信完了"
                  ) : (
                    "🗑 クリア"
                  )}
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
              border: "1px solid var(--card-border)",
              padding: "1rem",
              borderRadius: "8px",
              maxHeight: "40%",
              overflowY: "auto",
              backgroundColor: "var(--card-bg)",
            }}
          >
            <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-color)" }}>
              👥 接続中のキャスター
              <span
                style={{
                  fontSize: "0.9rem",
                  fontWeight: "normal",
                  color: "var(--muted-text)",
                }}
              >
                ({serverState.clients.length})
              </span>
            </h3>
            {serverState.clients.length === 0 ? (
              <p style={{ color: "var(--muted-text)", fontStyle: "italic" }}>
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
                      border: "1px solid var(--card-border)",
                      borderRadius: "6px",
                      backgroundColor: "var(--secondary-bg)",
                    }}
                  >
                    <div style={{ fontWeight: "600", fontSize: "1rem", marginBottom: "0.25rem", color: "var(--text-color)" }}>
                      {client.name}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted-text)" }}>
                      担当モニター: {client.monitor_ids.map(id => id).join(", ")}
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
              border: "1px solid var(--card-border)",
              padding: "1rem",
              borderRadius: "8px",
              flex: 1,
              overflowY: "auto",
              backgroundColor: "var(--card-bg)",
            }}
          >
            <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-color)" }}>
              📤 送信メッセージとフィードバック
              <span
                style={{
                  fontSize: "0.9rem",
                  fontWeight: "normal",
                  color: "var(--muted-text)",
                }}
              >
                ({serverState.sentMessages.length})
              </span>
            </h3>
            {serverState.sentMessages.length === 0 ? (
              <p style={{ color: "var(--muted-text)", fontStyle: "italic" }}>
                まだメッセージを送信していません
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {messagesWithFeedback.map((item) => {
                  if (!item) return null;
                  const { msg, feedbacks } = item;

                  const msgPriorityColor = priorityColor[msg.payload.priority] || "var(--text-color)";

                  return (
                        <div
                          key={msg.id}
                          style={{
                            padding: "1rem",
                            border: "1px solid var(--card-border)",
                            borderRadius: "8px",
                            backgroundColor: "var(--secondary-bg)",
                          }}
                        >
                          {/* Sent Message */}
                          <div style={{ marginBottom: "0.75rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <span style={{ fontSize: "1.1rem", fontWeight: "600", color: msgPriorityColor }}>
                                  📢 {msg.payload.content}
                                </span>
                                <span
                                  style={{
                                    fontSize: "0.75rem",
                                    padding: "0.125rem 0.5rem",
                                    borderRadius: "3px",
                                    backgroundColor: msgPriorityColor,
                                    color: "#fff",
                                    fontWeight: "600",
                                  }}
                                >
                                  {msg.payload.priority === "urgent" ? "🚨 緊急" : msg.payload.priority === "high" ? "⚠ 重要" : "📝 通常"}
                                </span>
                              </div>
                              <span style={{ fontSize: "0.85rem", color: "var(--muted-text)" }}>
                                {formatTimestamp(msg.timestamp)}
                              </span>
                            </div>
                            <div style={{ fontSize: "0.85rem", color: "var(--muted-text)" }}>
                              送信先: モニター {msg.payload.target_monitor_ids.includes("ALL") ? "全て" : msg.payload.target_monitor_ids.join(", ")}
                            </div>
                          </div>

                          {/* Feedback for this message */}
                          <div
                            style={{
                              paddingLeft: "1rem",
                              borderLeft: "3px solid var(--card-border)",
                            }}
                          >
                            {feedbacks.length === 0 ? (
                              <div style={{ fontSize: "0.9rem", color: "var(--muted-text)", fontStyle: "italic" }}>
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
                                          backgroundColor: "var(--card-bg)",
                                          border: "1px solid var(--card-border)",
                                        }}
                                      >
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                                          <strong style={{ color: "var(--accent-color)", fontSize: "0.9rem" }}>
                                            {feedbackTypeEmoji[fb.payload.feedback_type] || "•"} {fb.payload.client_name}
                                          </strong>
                                          <span style={{ fontSize: "0.75rem", color: "var(--muted-text)" }}>
                                            {formatTimestamp(fb.timestamp)}
                                          </span>
                                        </div>
                                        <div style={{ fontSize: "0.9rem", color: "var(--text-color)" }}>
                                          {fb.payload.content}
                                        </div>
                                        <div style={{ fontSize: "0.75rem", color: "var(--muted-text)", marginTop: "0.125rem" }}>
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
                })}
              </div>
            )}
          </div>

          {/* New Feedback Messages (not replies) */}
          <div
            className="scrollable"
            style={{
              border: "1px solid var(--card-border)",
              padding: "1rem",
              borderRadius: "8px",
              overflowY: "auto",
              backgroundColor: "var(--card-bg)",
              maxHeight: "300px",
            }}
          >
            <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-color)" }}>
              💬 新規フィードバック
              <span
                style={{
                  fontSize: "0.9rem",
                  fontWeight: "normal",
                  color: "var(--muted-text)",
                }}
              >
                ({newFeedbacks.length})
              </span>
            </h3>
            {newFeedbacks.length === 0 ? (
              <p style={{ color: "var(--muted-text)", fontStyle: "italic" }}>
                新規フィードバックはありません
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {newFeedbacks
                  .slice()
                  .reverse()
                  .map((fb) => {
                    if (fb.type === "feedback_message") {
                      return (
                        <div
                          key={fb.id}
                          style={{
                            padding: "0.75rem",
                            borderRadius: "6px",
                            backgroundColor: "var(--secondary-bg)",
                            border: "1px solid var(--card-border)",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                            <strong style={{ color: "var(--accent-color)", fontSize: "1rem" }}>
                              {feedbackTypeEmoji[fb.payload.feedback_type] || "•"} {fb.payload.client_name}
                            </strong>
                            <span style={{ fontSize: "0.85rem", color: "var(--muted-text)" }}>
                              {formatTimestamp(fb.timestamp)}
                            </span>
                          </div>
                          <div style={{ fontSize: "1rem", color: "var(--text-color)", marginBottom: "0.25rem" }}>
                            {fb.payload.content}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--muted-text)" }}>
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
      ) : null}

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spinner {
          display: inline-block;
          animation: spin 0.8s linear infinite;
        }
      `}</style>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ isOpen: false, message: "", onConfirm: () => {} })}
        confirmButtonColor="#ef4444"
      />
    </div>
  );
}
