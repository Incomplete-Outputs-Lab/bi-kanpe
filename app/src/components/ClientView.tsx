import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useClientState } from "../hooks/useClientState";
import { ThemeToggle } from "./ThemeToggle";
import { ConfirmDialog } from "./ConfirmDialog";
import type { Message } from "../types/messages";

interface ClientViewProps {
  onBackToMenu: () => void;
}

export function ClientView({ onBackToMenu }: ClientViewProps) {
  const [serverAddress, setServerAddress] = useState<string>("localhost:9876");
  const [clientName, setClientName] = useState<string>("Caster 1");
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [showDisconnectWarning, setShowDisconnectWarning] = useState<boolean>(true);
  const [streamDeckPort, setStreamDeckPort] = useState<number>(9877);
  const [streamDeckStatus, setStreamDeckStatus] = useState<boolean>(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    message: "",
    onConfirm: () => {},
  });

  // Use empty array for display_monitor_ids - we'll receive all messages and filter in popout windows
  const clientState = useClientState([]);

  // Load client name from localStorage
  useEffect(() => {
    const savedClientName = localStorage.getItem("clientName");
    if (savedClientName) {
      setClientName(savedClientName);
    }
  }, []);

  // Save client name to localStorage
  useEffect(() => {
    if (clientName) {
      localStorage.setItem("clientName", clientName);
    }
  }, [clientName]);

  // Get available monitor IDs from server
  const availableMonitors = clientState.availableMonitors;

  // Current message per monitor (last message targeting that monitor or ALL)
  const currentMessagePerMonitor = useMemo(() => {
    const map = new Map<string, Message>();
    for (const monitor of availableMonitors) {
      const last = clientState.messages
        .filter((msg): msg is Message & { type: "kanpe_message" } => {
          if (msg.type !== "kanpe_message") return false;
          const targetIds = msg.payload.target_monitor_ids;
          return targetIds.includes("ALL") || targetIds.includes(monitor.id);
        })
        .slice(-1)[0];
      if (last) map.set(monitor.id, last);
    }
    return map;
  }, [clientState.messages, availableMonitors]);

  const timersSnapshot = clientState.timers;

  // 自身の display_monitor_ids に紐づいたタイマーのみ表示（メイン画面は [] のため全タイマー）
  const visibleTimers = useMemo(() => {
    const entries = timersSnapshot?.timers ?? [];
    if (entries.length === 0) return [];
    const displayIds: string[] = [];
    if (displayIds.length === 0) return entries;
    return entries.filter((e) => {
      const t = e.definition.target_monitor_ids ?? [];
      return t.includes("ALL") || t.some((id) => displayIds.includes(id));
    });
  }, [timersSnapshot]);

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
        return "var(--card-bg)";
    }
  };

  const handleConnect = async () => {
    try {
      setError(null);
      setIsConnecting(true);
      setShowDisconnectWarning(true); // Reset warning visibility on new connection
      // Save client name to localStorage for popout windows
      localStorage.setItem("clientName", clientName);
      // Connect with empty display_monitor_ids to receive all messages
      await invoke("connect_to_server", {
        serverAddress,
        clientName,
        displayMonitorIds: [],
      });
      // Don't hide connection panel - keep it visible to show monitor list
    } catch (err) {
      setError(String(err));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setError(null);
      // Stop StreamDeck server if running
      if (streamDeckStatus) {
        await invoke("stop_streamdeck_server");
        setStreamDeckStatus(false);
      }
      await invoke("disconnect_from_server");
    } catch (err) {
      setError(String(err));
    }
  };

  const handleStreamDeckToggle = async () => {
    try {
      if (streamDeckStatus) {
        // Stop StreamDeck server
        await invoke("stop_streamdeck_server");
        setStreamDeckStatus(false);
      } else {
        // Start StreamDeck server
        await invoke("start_streamdeck_server", { port: streamDeckPort });
        setStreamDeckStatus(true);
      }
    } catch (err) {
      setError(String(err));
    }
  };

  // Check StreamDeck status periodically
  useEffect(() => {
    if (!clientState.isConnected) return;

    const checkStatus = async () => {
      try {
        const status = await invoke<boolean>("get_streamdeck_status");
        setStreamDeckStatus(status);
      } catch (err) {
        console.error("Failed to check StreamDeck status:", err);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, [clientState.isConnected]);

  const handleBackToMenu = async () => {
    if (clientState.isConnected) {
      setConfirmDialog({
        isOpen: true,
        message: "サーバーに接続中です。切断してメインメニューに戻りますか？",
        onConfirm: async () => {
          setConfirmDialog({ isOpen: false, message: "", onConfirm: () => {} });
          await handleDisconnect();
          onBackToMenu();
        },
      });
      return;
    }
    onBackToMenu();
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

  const handlePopoutMonitor = async (monitorId: string, monitorName: string) => {
    try {
      await invoke("create_popout_window", {
        monitorId,
        monitorName,
      });
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}>
      {/* Connection Panel */}
      <div
        className="scrollable"
        style={{
          padding: "1.5rem",
          maxHeight: "100vh",
          overflowY: "auto",
        }}
      >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <h2 style={{ margin: 0, color: "var(--accent-color)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              🎤 キャスターモード
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
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              maxWidth: "700px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ fontWeight: "600", color: "var(--text-color)" }}>サーバーアドレス:</label>
              <input
                type="text"
                value={serverAddress}
                onChange={(e) => setServerAddress(e.target.value)}
                placeholder="localhost:9876"
                style={{
                  padding: "0.75rem",
                  borderRadius: "4px",
                  border: "1px solid var(--input-border)",
                  fontSize: "1rem",
                  width: "100%",
                }}
                disabled={clientState.isConnected}
              />
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted-text)", fontStyle: "italic" }}>
                💡 カンペが起動したサーバーのアドレスとポート番号
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ fontWeight: "600", color: "var(--text-color)" }}>キャスター名:</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Caster 1"
                style={{
                  padding: "0.75rem",
                  borderRadius: "4px",
                  border: "1px solid var(--input-border)",
                  fontSize: "1rem",
                  width: "100%",
                }}
                disabled={clientState.isConnected}
              />
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted-text)", fontStyle: "italic" }}>
                💡 カンペ側に表示される識別名
              </p>
            </div>

            {clientState.isConnected && (
              <>
                {/* StreamDeck Integration Section */}
                <div style={{ 
                  padding: "1rem", 
                  borderRadius: "6px", 
                  backgroundColor: "var(--card-bg)",
                  border: "1px solid var(--card-border)",
                  display: "flex", 
                  flexDirection: "column", 
                  gap: "0.75rem" 
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <label style={{ fontWeight: "600", color: "var(--text-color)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        🎮 StreamDeck統合
                      </label>
                      <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "var(--muted-text)" }}>
                        StreamDeckプラグインからの接続を許可します
                      </p>
                    </div>
                    <button
                      onClick={handleStreamDeckToggle}
                      style={{
                        padding: "0.5rem 1.5rem",
                        fontSize: "1rem",
                        fontWeight: "600",
                        backgroundColor: streamDeckStatus ? "#ef4444" : "var(--accent-color)",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      {streamDeckStatus ? "停止" : "起動"}
                    </button>
                  </div>
                  
                  {!streamDeckStatus && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <label style={{ fontWeight: "600", color: "var(--text-color)", fontSize: "0.9rem" }}>ポート番号:</label>
                      <input
                        type="number"
                        value={streamDeckPort}
                        onChange={(e) => setStreamDeckPort(parseInt(e.target.value) || 9877)}
                        placeholder="9877"
                        style={{
                          padding: "0.5rem",
                          borderRadius: "4px",
                          border: "1px solid var(--input-border)",
                          fontSize: "0.95rem",
                          width: "150px",
                        }}
                        disabled={streamDeckStatus}
                      />
                    </div>
                  )}

                  {streamDeckStatus && (
                    <div style={{ 
                      padding: "0.75rem",
                      backgroundColor: "rgba(34, 197, 94, 0.1)",
                      color: "#22c55e",
                      border: "1px solid #22c55e",
                      borderRadius: "4px",
                      fontWeight: "600",
                      fontSize: "0.9rem"
                    }}>
                      ✓ StreamDeckサーバーが起動中 (ポート: {streamDeckPort})
                    </div>
                  )}
                </div>
              </>
            )}

            {clientState.isConnected && availableMonitors.length > 0 && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <label style={{ fontWeight: "600", color: "var(--text-color)" }}>現在表示中のカンペ:</label>
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
                      const bgColor = msg?.type === "kanpe_message"
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
                          <button
                            onClick={() => handlePopoutMonitor(monitor.id, monitor.name)}
                            style={{
                              padding: "0.4rem 0.75rem",
                              fontSize: "0.85rem",
                              backgroundColor: "#667eea",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontWeight: "600",
                              alignSelf: "flex-start",
                            }}
                            title="ポップアウト"
                          >
                            🗗 ポップアウト
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted-text)", fontStyle: "italic" }}>
                    💡 各モニターに表示中のカンペ内容です。🗗で別ウィンドウに大きく表示できます
                  </p>
                </div>
              </>
            )}

            {/* タイマー: カンペの下・画面下中央にでっかく表示 */}
            {clientState.isConnected && visibleTimers.length > 0 && (
              <div
                style={{
                  marginTop: "2rem",
                  width: "100%",
                  maxWidth: "900px",
                  marginLeft: "auto",
                  marginRight: "auto",
                  padding: "2rem",
                  borderRadius: "16px",
                  backgroundColor: "var(--card-bg)",
                  border: "3px solid var(--card-border)",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    color: "var(--text-color)",
                    marginBottom: "1rem",
                  }}
                >
                  ⏱ タイマー
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    gap: "2rem",
                  }}
                >
                  {visibleTimers.map((entry) => {
                    const stateLabel =
                      entry.runtime.state === "running"
                        ? "▶ 進行中"
                        : entry.runtime.state === "paused"
                          ? "⏸ 一時停止"
                          : entry.runtime.state === "completed"
                            ? "✓ 完了"
                            : entry.runtime.state === "cancelled"
                              ? "✕ 中止"
                              : "待機中";
                    const totalSeconds = Math.max(
                      0,
                      Math.floor(entry.runtime.remaining_ms / 1000)
                    );
                    const hours = Math.floor(totalSeconds / 3600);
                    const minutes = Math.floor((totalSeconds % 3600) / 60);
                    const seconds = totalSeconds % 60;
                    const pad = (n: number) => n.toString().padStart(2, "0");
                    const timeStr =
                      hours > 0
                        ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
                        : `${pad(minutes)}:${pad(seconds)}`;
                    return (
                      <div
                        key={entry.definition.id}
                        style={{
                          padding: "1.5rem 2rem",
                          borderRadius: "16px",
                          backgroundColor: "var(--secondary-bg)",
                          border: "3px solid var(--card-border)",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "0.5rem",
                          minWidth: "220px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "1.5rem",
                            fontWeight: 700,
                            color: "var(--text-color)",
                          }}
                        >
                          {entry.definition.name}
                        </span>
                        <span
                          style={{
                            fontVariantNumeric: "tabular-nums",
                            fontSize: "4rem",
                            fontWeight: 800,
                            color: "var(--accent-color)",
                            lineHeight: 1.1,
                            letterSpacing: "0.02em",
                          }}
                        >
                          {timeStr}
                        </span>
                        <span
                          style={{
                            fontSize: "1.1rem",
                            color: "var(--muted-text)",
                            fontWeight: 600,
                          }}
                        >
                          {stateLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ marginTop: "0.5rem" }}>
              {!clientState.isConnected ? (
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  style={{
                    padding: "0.75rem 2rem",
                    fontSize: "1.1rem",
                    fontWeight: "600",
                    backgroundColor: isConnecting ? "#9ca3af" : "var(--accent-color)",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: isConnecting ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  {isConnecting ? (
                    <>
                      <span className="spinner"></span>
                      接続中...
                    </>
                  ) : (
                    "🔗 サーバーに接続"
                  )}
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
                    <span style={{ color: "var(--input-text)", backgroundColor: "var(--input-bg)", padding: "0.25rem 0.75rem", borderRadius: "4px", border: "1px solid var(--input-border)", fontWeight: "700" }}>
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
                </div>
              )}
            </div>

            {error && (
              <div
                style={{
                  padding: "0.75rem",
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  color: "#ef4444",
                  border: "2px solid #ef4444",
                  borderRadius: "6px",
                  fontWeight: "600",
                }}
              >
                ❌ エラー: {error}
              </div>
            )}

            {clientState.disconnectReason && !clientState.isConnected && showDisconnectWarning && (
              <div
                style={{
                  padding: "0.75rem",
                  backgroundColor: "rgba(245, 158, 11, 0.1)",
                  color: "#f59e0b",
                  border: "2px solid #f59e0b",
                  borderRadius: "6px",
                  fontWeight: "600",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>⚠️ 切断されました: {clientState.disconnectReason}</span>
                <button
                  onClick={() => setShowDisconnectWarning(false)}
                  style={{
                    padding: "0.25rem 0.75rem",
                    fontSize: "0.9rem",
                    backgroundColor: "#f59e0b",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                >
                  閉じる
                </button>
              </div>
            )}
          </div>
      </div>

      {/* CSS for spinner */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spinner {
          display: inline-block;
          width: 1rem;
          height: 1rem;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
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
