import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  TemplateConfig,
  ServerTemplate,
  ClientTemplate,
  Priority,
  FeedbackType,
} from "../types/messages";

export function useTemplates() {
  const [config, setConfig] = useState<TemplateConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const templates = await invoke<TemplateConfig>("get_templates");
      setConfig(templates);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const addServerTemplate = async (content: string, priority: Priority): Promise<void> => {
    try {
      setError(null);
      const template = await invoke<ServerTemplate>("add_server_template", {
        content,
        priority,
      });
      if (config) {
        setConfig({
          ...config,
          server_templates: [...config.server_templates, template],
        });
      }
    } catch (err) {
      setError(String(err));
      throw err;
    }
  };

  const updateServerTemplate = async (
    id: string,
    content: string,
    priority: Priority
  ) => {
    try {
      setError(null);
      await invoke("update_server_template", { id, content, priority });
      if (config) {
        setConfig({
          ...config,
          server_templates: config.server_templates.map((t) =>
            t.id === id ? { ...t, content, priority } : t
          ),
        });
      }
    } catch (err) {
      setError(String(err));
      throw err;
    }
  };

  const deleteServerTemplate = async (id: string) => {
    try {
      setError(null);
      await invoke("delete_server_template", { id });
      if (config) {
        setConfig({
          ...config,
          server_templates: config.server_templates.filter((t) => t.id !== id),
        });
      }
    } catch (err) {
      setError(String(err));
      throw err;
    }
  };

  const addClientTemplate = async (
    content: string,
    feedbackType: FeedbackType
  ): Promise<void> => {
    try {
      setError(null);
      const template = await invoke<ClientTemplate>("add_client_template", {
        content,
        feedbackType,
      });
      if (config) {
        setConfig({
          ...config,
          client_templates: [...config.client_templates, template],
        });
      }
    } catch (err) {
      setError(String(err));
      throw err;
    }
  };

  const updateClientTemplate = async (
    id: string,
    content: string,
    feedbackType: FeedbackType
  ) => {
    try {
      setError(null);
      await invoke("update_client_template", { id, content, feedbackType });
      if (config) {
        setConfig({
          ...config,
          client_templates: config.client_templates.map((t) =>
            t.id === id ? { ...t, content, feedback_type: feedbackType } : t
          ),
        });
      }
    } catch (err) {
      setError(String(err));
      throw err;
    }
  };

  const deleteClientTemplate = async (id: string) => {
    try {
      setError(null);
      await invoke("delete_client_template", { id });
      if (config) {
        setConfig({
          ...config,
          client_templates: config.client_templates.filter((t) => t.id !== id),
        });
      }
    } catch (err) {
      setError(String(err));
      throw err;
    }
  };

  return {
    config,
    loading,
    error,
    loadTemplates,
    addServerTemplate,
    updateServerTemplate,
    deleteServerTemplate,
    addClientTemplate,
    updateClientTemplate,
    deleteClientTemplate,
  };
}
