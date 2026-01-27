import { useState } from "react";
import type { ServerTemplate, ClientTemplate, Priority, FeedbackType } from "../types/messages";

interface TemplateManagerProps {
  mode: "server" | "client";
  serverTemplates: ServerTemplate[];
  clientTemplates: ClientTemplate[];
  onAddServerTemplate: (content: string, priority: Priority) => Promise<void>;
  onUpdateServerTemplate: (id: string, content: string, priority: Priority) => Promise<void>;
  onDeleteServerTemplate: (id: string) => Promise<void>;
  onAddClientTemplate: (content: string, feedbackType: FeedbackType) => Promise<void>;
  onUpdateClientTemplate: (id: string, content: string, feedbackType: FeedbackType) => Promise<void>;
  onDeleteClientTemplate: (id: string) => Promise<void>;
  onSelectTemplate?: (template: ServerTemplate | ClientTemplate) => void;
}

export function TemplateManager({
  mode,
  serverTemplates,
  clientTemplates,
  onAddServerTemplate,
  onUpdateServerTemplate,
  onDeleteServerTemplate,
  onAddClientTemplate,
  onUpdateClientTemplate,
  onDeleteClientTemplate,
  onSelectTemplate,
}: TemplateManagerProps) {
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newContent, setNewContent] = useState<string>("");
  const [newPriority, setNewPriority] = useState<Priority>("normal");
  const [newFeedbackType, setNewFeedbackType] = useState<FeedbackType>("ack");

  const templates = mode === "server" ? serverTemplates : clientTemplates;

  const handleAdd = async () => {
    if (!newContent.trim()) return;

    try {
      if (mode === "server") {
        await onAddServerTemplate(newContent, newPriority);
      } else {
        await onAddClientTemplate(newContent, newFeedbackType);
      }
      setNewContent("");
      setNewPriority("normal");
      setNewFeedbackType("ack");
      setIsAdding(false);
    } catch (err) {
      console.error("Failed to add template:", err);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!newContent.trim()) return;

    try {
      if (mode === "server") {
        await onUpdateServerTemplate(id, newContent, newPriority);
      } else {
        await onUpdateClientTemplate(id, newContent, newFeedbackType);
      }
      setEditingId(null);
      setNewContent("");
    } catch (err) {
      console.error("Failed to update template:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("このテンプレートを削除しますか？")) return;

    try {
      if (mode === "server") {
        await onDeleteServerTemplate(id);
      } else {
        await onDeleteClientTemplate(id);
      }
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
  };

  const startEdit = (template: ServerTemplate | ClientTemplate) => {
    setEditingId(template.id);
    setNewContent(template.content);
    if (mode === "server" && "priority" in template) {
      setNewPriority(template.priority);
    } else if (mode === "client" && "feedback_type" in template) {
      setNewFeedbackType(template.feedback_type);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNewContent("");
    setNewPriority("normal");
    setNewFeedbackType("ack");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h4 style={{ margin: 0, fontSize: "1rem", color: "#333" }}>
          📝 {mode === "server" ? "メッセージ" : "フィードバック"}テンプレート
        </h4>
        <button
          onClick={() => setIsAdding(!isAdding)}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "0.9rem",
            fontWeight: "600",
            backgroundColor: isAdding ? "#6b7280" : "#22c55e",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          {isAdding ? "キャンセル" : "➕ 追加"}
        </button>
      </div>

      {/* Add Template Form */}
      {isAdding && (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#f9f9f9",
            borderRadius: "6px",
            border: "2px solid #22c55e",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <input
              type="text"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="テンプレート内容を入力..."
              style={{
                padding: "0.5rem",
                borderRadius: "4px",
                border: "1px solid #ccc",
                fontSize: "0.95rem",
              }}
            />
            {mode === "server" ? (
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as Priority)}
                style={{
                  padding: "0.5rem",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  fontSize: "0.95rem",
                }}
              >
                <option value="normal">通常</option>
                <option value="high">重要</option>
                <option value="urgent">緊急</option>
              </select>
            ) : (
              <select
                value={newFeedbackType}
                onChange={(e) => setNewFeedbackType(e.target.value as FeedbackType)}
                style={{
                  padding: "0.5rem",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  fontSize: "0.95rem",
                }}
              >
                <option value="ack">了解</option>
                <option value="question">質問</option>
                <option value="issue">問題</option>
                <option value="info">情報</option>
              </select>
            )}
            <button
              onClick={handleAdd}
              disabled={!newContent.trim()}
              style={{
                padding: "0.5rem",
                fontSize: "0.95rem",
                fontWeight: "600",
                backgroundColor: newContent.trim() ? "#22c55e" : "#d1d5db",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: newContent.trim() ? "pointer" : "not-allowed",
              }}
            >
              追加
            </button>
          </div>
        </div>
      )}

      {/* Template List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {templates.length === 0 ? (
          <p style={{ color: "#999", fontStyle: "italic", fontSize: "0.9rem", margin: 0 }}>
            テンプレートがありません
          </p>
        ) : (
          templates.map((template) => (
            <div
              key={template.id}
              style={{
                padding: "0.75rem",
                backgroundColor: editingId === template.id ? "#fffbeb" : "#ffffff",
                border: editingId === template.id ? "2px solid #f59e0b" : "1px solid #e5e7eb",
                borderRadius: "6px",
              }}
            >
              {editingId === template.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <input
                    type="text"
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    style={{
                      padding: "0.5rem",
                      borderRadius: "4px",
                      border: "1px solid #ccc",
                      fontSize: "0.95rem",
                    }}
                  />
                  {mode === "server" ? (
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as Priority)}
                      style={{
                        padding: "0.5rem",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                        fontSize: "0.95rem",
                      }}
                    >
                      <option value="normal">通常</option>
                      <option value="high">重要</option>
                      <option value="urgent">緊急</option>
                    </select>
                  ) : (
                    <select
                      value={newFeedbackType}
                      onChange={(e) => setNewFeedbackType(e.target.value as FeedbackType)}
                      style={{
                        padding: "0.5rem",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                        fontSize: "0.95rem",
                      }}
                    >
                      <option value="ack">了解</option>
                      <option value="question">質問</option>
                      <option value="issue">問題</option>
                      <option value="info">情報</option>
                    </select>
                  )}
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={() => handleUpdate(template.id)}
                      disabled={!newContent.trim()}
                      style={{
                        flex: 1,
                        padding: "0.5rem",
                        fontSize: "0.9rem",
                        fontWeight: "600",
                        backgroundColor: newContent.trim() ? "#3b82f6" : "#d1d5db",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: newContent.trim() ? "pointer" : "not-allowed",
                      }}
                    >
                      保存
                    </button>
                    <button
                      onClick={cancelEdit}
                      style={{
                        flex: 1,
                        padding: "0.5rem",
                        fontSize: "0.9rem",
                        fontWeight: "600",
                        backgroundColor: "#6b7280",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div
                    onClick={() => onSelectTemplate?.(template)}
                    style={{
                      flex: 1,
                      cursor: onSelectTemplate ? "pointer" : "default",
                    }}
                  >
                    <div style={{ fontSize: "0.95rem", fontWeight: "600", color: "#333" }}>
                      {template.content}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                      {mode === "server" && "priority" in template
                        ? `優先度: ${template.priority}`
                        : mode === "client" && "feedback_type" in template
                        ? `種別: ${template.feedback_type}`
                        : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={() => startEdit(template)}
                      style={{
                        padding: "0.25rem 0.75rem",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        backgroundColor: "#f59e0b",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      style={{
                        padding: "0.25rem 0.75rem",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        backgroundColor: "#ef4444",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      削除
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
