import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useClientState } from "../hooks/useClientState";

interface MonitorPopoutProps {
  monitorId: number;
  monitorName: string;
}

export default function MonitorPopout({
  monitorId,
  monitorName,
}: MonitorPopoutProps) {
  const clientState = useClientState([monitorId]);
  const [feedbackContent, setFeedbackContent] = useState("");
  const [feedbackType, setFeedbackType] = useState("ack");

  const handleSendFeedback = async () => {
    if (!feedbackContent.trim()) return;

    try {
      await invoke("send_feedback", {
        content: feedbackContent,
        sourceMonitorId: monitorId, // Automatically set to this monitor
        replyToMessageId: null,
        feedbackType,
      });
      setFeedbackContent("");
    } catch (error) {
      console.error("Failed to send feedback:", error);
    }
  };

  // Filter messages for this specific monitor
  const monitorMessages = clientState.messages.filter((msg) => {
    if (msg.type === "kanpe_message") {
      const targetIds = msg.payload.target_monitor_ids;
      return targetIds.includes(0) || targetIds.includes(monitorId);
    }
    return false;
  });

  if (!clientState.isConnected) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">切断中</h1>
          <p className="text-gray-400">サーバーとの接続が切れています</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold">{monitorName}</h1>
        <p className="text-sm text-gray-400">
          サーバー: {clientState.serverName || "Unknown"}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {monitorMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">メッセージはまだありません</p>
          </div>
        ) : (
          monitorMessages.map((msg) => {
            if (msg.type === "kanpe_message") {
              const priorityColor =
                msg.payload.priority === "urgent"
                  ? "border-red-500"
                  : msg.payload.priority === "high"
                  ? "border-yellow-500"
                  : "border-blue-500";

              return (
                <div
                  key={msg.id}
                  className={`bg-gray-800 p-4 rounded-lg border-l-4 ${priorityColor}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-gray-400">
                      {new Date(msg.timestamp).toLocaleString("ja-JP")}
                    </span>
                    <span className="text-xs px-2 py-1 bg-gray-700 rounded">
                      {msg.payload.priority}
                    </span>
                  </div>
                  <p className="text-lg whitespace-pre-wrap">
                    {msg.payload.content}
                  </p>
                </div>
              );
            }
            return null;
          })
        )}
      </div>

      {/* Feedback Section */}
      <div className="bg-gray-800 p-4 border-t border-gray-700">
        <h2 className="text-sm font-semibold mb-2">フィードバック送信</h2>
        <div className="flex gap-2">
          <select
            value={feedbackType}
            onChange={(e) => setFeedbackType(e.target.value)}
            className="bg-gray-700 text-white px-3 py-2 rounded"
          >
            <option value="ack">確認</option>
            <option value="question">質問</option>
            <option value="issue">問題</option>
            <option value="info">情報</option>
          </select>
          <input
            type="text"
            value={feedbackContent}
            onChange={(e) => setFeedbackContent(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSendFeedback()}
            placeholder="フィードバックを入力..."
            className="flex-1 bg-gray-700 text-white px-4 py-2 rounded"
          />
          <button
            onClick={handleSendFeedback}
            disabled={!feedbackContent.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-2 rounded font-semibold"
          >
            送信
          </button>
        </div>
      </div>
    </div>
  );
}
