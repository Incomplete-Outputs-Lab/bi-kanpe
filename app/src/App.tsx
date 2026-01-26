import { useState } from "react";
import { ModeSelector } from "./components/ModeSelector";
import { ServerView } from "./components/ServerView";
import { ClientView } from "./components/ClientView";
import "./App.css";

type AppMode = "not_selected" | "server" | "client";

function App() {
  const [mode, setMode] = useState<AppMode>("not_selected");

  const handleSelectMode = (selectedMode: "server" | "client") => {
    setMode(selectedMode);
  };

  const handleBackToModeSelection = () => {
    setMode("not_selected");
  };

  return (
    <main>
      {mode === "not_selected" && <ModeSelector onSelectMode={handleSelectMode} />}
      {mode === "server" && <ServerView onBackToMenu={handleBackToModeSelection} />}
      {mode === "client" && <ClientView onBackToMenu={handleBackToModeSelection} />}
    </main>
  );
}

export default App;
