import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface AppVersionInfo {
  version: string;
  gitCommit: string | null;
  buildTimestamp: string | null;
}

export function useAppVersion() {
  const [versionInfo, setVersionInfo] = useState<AppVersionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const info = await invoke<AppVersionInfo>("get_app_version");
        setVersionInfo(info);
        setError(null);
      } catch (err) {
        console.error("Failed to get app version:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchVersion();
  }, []);

  return { versionInfo, loading, error };
}
