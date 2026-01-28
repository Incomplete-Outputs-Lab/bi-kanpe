import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useClientState } from "../hooks/useClientState";

interface ClientViewProps {
  onBackToMenu: () => void;
}

export function ClientView({ onBackToMenu }: ClientViewProps) {
  const [serverAddress, setServerAddress] = useState<string>("localhost:9876");
  const [clientName, setClientName] = useState<string>("Caster 1");
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [showDisconnectWarning, setShowDisconnectWarning] = useState<boolean>(true);

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
      await invoke("disconnect_from_server");
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
    <div style={{ minHeight: "100vh", backgroundColor: "#f9f9f9" }}>
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

            {clientState.isConnected && availableMonitors.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontWeight: "600", color: "#000" }}>利用可能なモニター:</label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: "0.5rem",
                  }}
                >
                  {availableMonitors.map((monitor) => (
                    <div
                      key={monitor.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.75rem",
                        borderRadius: "4px",
                        backgroundColor: "#f5f5f5",
                        borderLeft: monitor.color ? `4px solid ${monitor.color}` : "none",
                      }}
                    >
                      <span style={{ flex: 1, fontWeight: "600", color: "#333" }}>{monitor.name}</span>
                      <button
                        onClick={() => handlePopoutMonitor(monitor.id, monitor.name)}
                        style={{
                          padding: "0.5rem 1rem",
                          fontSize: "0.9rem",
                          backgroundColor: "#667eea",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontWeight: "600",
                        }}
                        title="ポップアウト"
                      >
                        🗗 ポップアウト
                      </button>
                    </div>
                  ))}
                </div>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#555", fontStyle: "italic" }}>
                  💡 🗗ボタンをクリックして各モニターを別ウィンドウに表示できます
                </p>
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
                    backgroundColor: isConnecting ? "#9ca3af" : "#764ba2",
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
                    <span style={{ color: "#ffffff", backgroundColor: "#374151", padding: "0.25rem 0.75rem", borderRadius: "4px", fontWeight: "700" }}>
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
                  backgroundColor: "#ffcccc",
                  border: "2px solid #ff0000",
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
                  backgroundColor: "#fef3c7",
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
    </div>
  );
}
