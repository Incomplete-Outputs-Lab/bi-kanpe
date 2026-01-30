import { useState, useEffect } from "react";
import { ModeSelector } from "./components/ModeSelector";
import { ServerView } from "./components/ServerView";
import { ClientView } from "./components/ClientView";
import MonitorPopout from "./components/MonitorPopout";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./App.css";

type AppMode = "not_selected" | "server" | "client";

function App() {
  const [mode, setMode] = useState<AppMode>("not_selected");
  const [isPopout, setIsPopout] = useState(false);
  const [popoutMonitorId, setPopoutMonitorId] = useState<string | null>(null);
  const [popoutMonitorName, setPopoutMonitorName] = useState<string>("");

  // Check if this is a popout window
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("popout") === "true") {
      const monitorId = params.get("monitor_id") || "";
      setIsPopout(true);
      setPopoutMonitorId(monitorId);
      setPopoutMonitorName(`Monitor ${monitorId}`); // Will be updated with real name from server
    }
  }, []);

  const handleSelectMode = (selectedMode: "server" | "client") => {
    setMode(selectedMode);
  };

  const handleBackToModeSelection = () => {
    setMode("not_selected");
  };

  // Render popout window UI
  if (isPopout && popoutMonitorId !== null) {
    return (
      <ThemeProvider>
        <MonitorPopout monitorId={popoutMonitorId} monitorName={popoutMonitorName} />
      </ThemeProvider>
    );
  }

  // Render normal app UI
  return (
    <ThemeProvider>
      <main>
        {mode === "not_selected" && <ModeSelector onSelectMode={handleSelectMode} />}
        {mode === "server" && <ServerView onBackToMenu={handleBackToModeSelection} />}
        {mode === "client" && <ClientView onBackToMenu={handleBackToModeSelection} />}
      </main>
    </ThemeProvider>
  );
}

export default App;
