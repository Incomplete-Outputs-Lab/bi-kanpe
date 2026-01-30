import { useEffect, useState } from "react";
import { useToast } from "../hooks/useToast";
import type { Toast as ToastType } from "../contexts/ToastContext";

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div
      style={{
        position: "fixed",
        top: "1rem",
        right: "1rem",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        maxWidth: "400px",
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: ToastType;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => {
      setIsExiting(false);
    }, 10);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 300);
  };

  const getBackgroundColor = () => {
    switch (toast.type) {
      case "success":
        return "#22c55e";
      case "error":
        return "#ef4444";
      case "warning":
        return "#f59e0b";
      case "info":
        return "#3b82f6";
      default:
        return "#6b7280";
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case "success":
        return "✓";
      case "error":
        return "✕";
      case "warning":
        return "⚠";
      case "info":
        return "ℹ";
      default:
        return "•";
    }
  };

  return (
    <div
      style={{
        backgroundColor: getBackgroundColor(),
        color: "white",
        padding: "0.875rem 1rem",
        borderRadius: "6px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        minWidth: "280px",
        maxWidth: "400px",
        animation: isExiting
          ? "slideOut 0.3s ease-out forwards"
          : "slideIn 0.3s ease-out",
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? "translateX(100%)" : "translateX(0)",
        transition: "opacity 0.3s ease-out, transform 0.3s ease-out",
      }}
    >
      <span
        style={{
          fontSize: "1.25rem",
          fontWeight: "bold",
          flexShrink: 0,
        }}
      >
        {getIcon()}
      </span>
      <span
        style={{
          flex: 1,
          fontSize: "0.95rem",
          fontWeight: "500",
          wordBreak: "break-word",
        }}
      >
        {toast.message}
      </span>
      <button
        onClick={handleClose}
        style={{
          background: "rgba(255, 255, 255, 0.2)",
          border: "none",
          color: "white",
          cursor: "pointer",
          borderRadius: "4px",
          padding: "0.25rem 0.5rem",
          fontSize: "0.875rem",
          fontWeight: "600",
          flexShrink: 0,
          transition: "background 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
        }}
      >
        ✕
      </button>
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slideOut {
          from {
            opacity: 1;
            transform: translateX(0);
          }
          to {
            opacity: 0;
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
