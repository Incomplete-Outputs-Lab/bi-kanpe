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
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "2rem",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "3rem" }}>
        <h1
          style={{
            fontSize: "3.5rem",
            fontWeight: "bold",
            color: "white",
            margin: "0 0 0.5rem 0",
            textShadow: "2px 2px 4px rgba(0,0,0,0.2)",
          }}
        >
          Bi-Kanpe
        </h1>
        <p
          style={{
            fontSize: "1.2rem",
            color: "rgba(255,255,255,0.9)",
            margin: 0,
          }}
        >
          カンペ・キャスター通信システム
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "2rem",
          maxWidth: "900px",
          width: "100%",
        }}
      >
        {/* Director Card */}
        <div
          onClick={() => onSelectMode("server")}
          style={{
            background: "white",
            borderRadius: "12px",
            padding: "2rem",
            cursor: "pointer",
            boxShadow: "0 8px 16px rgba(0,0,0,0.1)",
            transition: "all 0.3s ease",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-8px)";
            e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.1)";
          }}
        >
          <div
            style={{
              fontSize: "3rem",
              textAlign: "center",
              marginBottom: "0.5rem",
            }}
          >
            🎬
          </div>
          <h2
            style={{
              fontSize: "1.8rem",
              margin: 0,
              color: "#667eea",
              textAlign: "center",
            }}
          >
            カンペモード
          </h2>
          <p
            style={{
              fontSize: "1rem",
              color: "#555",
              margin: 0,
              textAlign: "center",
              fontWeight: "500",
            }}
          >
            Director (Server)
          </p>
          <div
            style={{
              borderTop: "1px solid #eee",
              paddingTop: "1rem",
              marginTop: "0.5rem",
            }}
          >
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                fontSize: "0.95rem",
                color: "#555",
                lineHeight: "1.8",
              }}
            >
              <li>✓ サーバーを起動して接続を待機</li>
              <li>✓ 複数のキャスターに指示を送信</li>
              <li>✓ モニターごとに異なるメッセージ配信</li>
              <li>✓ 優先度設定で緊急度を調整</li>
              <li>✓ キャスターからのフィードバック受信</li>
            </ul>
          </div>
          <div
            style={{
              marginTop: "auto",
              padding: "0.75rem",
              background: "#667eea",
              color: "white",
              textAlign: "center",
              borderRadius: "6px",
              fontWeight: "600",
              fontSize: "1rem",
            }}
          >
            カンペモードで起動
          </div>
        </div>

        {/* Caster Card */}
        <div
          onClick={() => onSelectMode("client")}
          style={{
            background: "white",
            borderRadius: "12px",
            padding: "2rem",
            cursor: "pointer",
            boxShadow: "0 8px 16px rgba(0,0,0,0.1)",
            transition: "all 0.3s ease",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-8px)";
            e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.1)";
          }}
        >
          <div
            style={{
              fontSize: "3rem",
              textAlign: "center",
              marginBottom: "0.5rem",
            }}
          >
            🎭
          </div>
          <h2
            style={{
              fontSize: "1.8rem",
              margin: 0,
              color: "#764ba2",
              textAlign: "center",
            }}
          >
            キャスターモード
          </h2>
          <p
            style={{
              fontSize: "1rem",
              color: "#555",
              margin: 0,
              textAlign: "center",
              fontWeight: "500",
            }}
          >
            Caster (Client)
          </p>
          <div
            style={{
              borderTop: "1px solid #eee",
              paddingTop: "1rem",
              marginTop: "0.5rem",
            }}
          >
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                fontSize: "0.95rem",
                color: "#555",
                lineHeight: "1.8",
              }}
            >
              <li>✓ カンペのサーバーに接続</li>
              <li>✓ 全画面でメッセージを表示</li>
              <li>✓ 優先度に応じた視覚表現</li>
              <li>✓ ワンクリックでフィードバック送信</li>
              <li>✓ 担当モニターを指定可能</li>
            </ul>
          </div>
          <div
            style={{
              marginTop: "auto",
              padding: "0.75rem",
              background: "#764ba2",
              color: "white",
              textAlign: "center",
              borderRadius: "6px",
              fontWeight: "600",
              fontSize: "1rem",
            }}
          >
            キャスターモードで起動
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: "2rem",
          color: "rgba(255,255,255,0.8)",
          fontSize: "0.9rem",
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0 }}>
          カンペは複数のキャスターに指示を出し、キャスターは受け取った指示を表示します
        </p>
      </div>
    </div>
  );
}
