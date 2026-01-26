import React from "react";

interface ModeSelectorProps {
  onSelectMode: (mode: "server" | "client") => void;
}

export function ModeSelector({ onSelectMode }: ModeSelectorProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        gap: "2rem",
      }}
    >
      <h1>Bi-Kanpe</h1>
      <p>Select your mode:</p>
      <div style={{ display: "flex", gap: "1rem" }}>
        <button
          onClick={() => onSelectMode("server")}
          style={{
            padding: "2rem 3rem",
            fontSize: "1.2rem",
            cursor: "pointer",
          }}
        >
          Director (Server)
        </button>
        <button
          onClick={() => onSelectMode("client")}
          style={{
            padding: "2rem 3rem",
            fontSize: "1.2rem",
            cursor: "pointer",
          }}
        >
          Performer (Client)
        </button>
      </div>
    </div>
  );
}
