import { invoke } from "@tauri-apps/api/core";

export interface AppConfig {
  has_seen_donation_prompt: boolean;
  first_launch_timestamp: number | null;
}

export function useAppConfig() {
  const checkFirstLaunch = async (): Promise<boolean> => {
    try {
      const isFirstLaunch = await invoke<boolean>("check_first_launch");
      return isFirstLaunch;
    } catch (error) {
      console.error("Failed to check first launch:", error);
      return false;
    }
  };

  const markDonationPromptSeen = async (): Promise<void> => {
    try {
      await invoke("mark_donation_prompt_seen");
    } catch (error) {
      console.error("Failed to mark donation prompt as seen:", error);
    }
  };

  const getAppConfig = async (): Promise<AppConfig | null> => {
    try {
      const config = await invoke<AppConfig>("get_app_config");
      return config;
    } catch (error) {
      console.error("Failed to get app config:", error);
      return null;
    }
  };

  return {
    checkFirstLaunch,
    markDonationPromptSeen,
    getAppConfig,
  };
}
