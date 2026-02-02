import { useState, useEffect } from "react";
import { ModeSelector } from "./components/ModeSelector";
import { ServerView } from "./components/ServerView";
import { ClientView } from "./components/ClientView";
import MonitorPopout from "./components/MonitorPopout";
import { DonationDialog } from "./components/DonationDialog";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastProvider } from "./contexts/ToastContext";
import { ToastContainer } from "./components/Toast";
import { useAppConfig } from "./hooks/useAppConfig";
import "./App.css";

type AppMode = "not_selected" | "server" | "client";

function App() {
  const [mode, setMode] = useState<AppMode>("not_selected");
  const [isPopout, setIsPopout] = useState(false);
  const [popoutMonitorId, setPopoutMonitorId] = useState<string | null>(null);
  const [popoutMonitorName, setPopoutMonitorName] = useState<string>("");
  const [showDonationDialog, setShowDonationDialog] = useState(false);
  const { checkFirstLaunch, markDonationPromptSeen } = useAppConfig();

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

  // Check for first launch and show donation dialog
  useEffect(() => {
    const checkAndShowDonation = async () => {
      // Only check on main window (not popout)
      if (!isPopout) {
        const isFirstLaunch = await checkFirstLaunch();
        if (isFirstLaunch) {
          setShowDonationDialog(true);
        }
      }
    };

    checkAndShowDonation();
  }, [isPopout, checkFirstLaunch]);

  const handleDonationDialogClose = async () => {
    await markDonationPromptSeen();
    setShowDonationDialog(false);
  };

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
        <ToastProvider>
          <MonitorPopout monitorId={popoutMonitorId} monitorName={popoutMonitorName} />
          <ToastContainer />
        </ToastProvider>
      </ThemeProvider>
    );
  }

  // Render normal app UI
  return (
    <ThemeProvider>
      <ToastProvider>
        <main>
          {mode === "not_selected" && <ModeSelector onSelectMode={handleSelectMode} />}
          {mode === "server" && <ServerView onBackToMenu={handleBackToModeSelection} />}
          {mode === "client" && <ClientView onBackToMenu={handleBackToModeSelection} />}
        </main>
        <DonationDialog isOpen={showDonationDialog} onClose={handleDonationDialogClose} />
        <ToastContainer />
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
