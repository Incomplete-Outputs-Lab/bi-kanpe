import { useEffect } from "react";
import { open } from "@tauri-apps/plugin-opener";

interface DonationDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DonationDialog({ isOpen, onClose }: DonationDialogProps) {
  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when dialog is open
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSupportClick = async () => {
    try {
      await open("http://subs.twitch.tv/flowingspdg");
      onClose();
    } catch (error) {
      console.error("Failed to open URL:", error);
      // Still close the dialog even if opening fails
      onClose();
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: "1rem",
        animation: "fadeIn 0.2s ease-out",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--card-bg)",
          borderRadius: "12px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
          maxWidth: "500px",
          width: "100%",
          padding: "2rem",
          animation: "scaleIn 0.2s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div
            style={{
              fontSize: "3rem",
              marginBottom: "1rem",
            }}
          >
            💝
          </div>
          <h2
            style={{
              margin: "0 0 0.5rem 0",
              fontSize: "1.5rem",
              fontWeight: "600",
              color: "var(--text-color)",
            }}
          >
            Bi-Kanpeをご利用いただきありがとうございます
          </h2>
        </div>

        {/* Message */}
        <div
          style={{
            marginBottom: "1.5rem",
            color: "var(--text-color)",
            lineHeight: "1.6",
          }}
        >
          <p style={{ margin: "0 0 1rem 0" }}>
            このアプリケーションは<strong>未完成成果物研究所</strong>
            により開発されています。
          </p>
          <p style={{ margin: "0 0 1rem 0" }}>
            開発を継続し、より良い機能を提供するために、
            サポートをご検討いただけますと幸いです。
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "0.9rem",
              color: "var(--muted-text)",
            }}
          >
            ※サポートは任意です。アプリは無料でご利用いただけます。
          </p>
        </div>

        {/* Buttons */}
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "0.75rem 1.5rem",
              fontSize: "1rem",
              fontWeight: "600",
              backgroundColor: "var(--secondary-bg)",
              color: "var(--text-color)",
              border: "1px solid var(--card-border)",
              borderRadius: "6px",
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
            後で
          </button>
          <button
            onClick={handleSupportClick}
            style={{
              padding: "0.75rem 1.5rem",
              fontSize: "1rem",
              fontWeight: "600",
              backgroundColor: "#9146FF",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = "brightness(0.9)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = "brightness(1)";
            }}
          >
            <span>💜</span>
            サポートする
          </button>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
