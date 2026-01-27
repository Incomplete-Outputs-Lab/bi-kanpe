// TypeScript types matching Rust message types

export type Priority = "normal" | "high" | "urgent";
export type FeedbackType = "ack" | "question" | "issue" | "info";

export interface ClientHelloPayload {
  client_name: string;
  display_monitor_ids: number[];
}

export interface ServerWelcomePayload {
  server_name: string;
  assigned_client_id: string;
}

export interface KanpeMessagePayload {
  content: string;
  target_monitor_ids: number[];
  priority: Priority;
}

export interface FeedbackMessagePayload {
  content: string;
  client_name: string;
  reply_to_message_id: string;
  feedback_type: FeedbackType;
}

export interface FlashCommandPayload {
  target_monitor_ids: number[];
}

export interface ClearCommandPayload {
  target_monitor_ids: number[];
}

export type Message =
  | {
      type: "client_hello";
      id: string;
      timestamp: number;
      payload: ClientHelloPayload;
    }
  | {
      type: "server_welcome";
      id: string;
      timestamp: number;
      payload: ServerWelcomePayload;
    }
  | {
      type: "kanpe_message";
      id: string;
      timestamp: number;
      payload: KanpeMessagePayload;
    }
  | {
      type: "feedback_message";
      id: string;
      timestamp: number;
      payload: FeedbackMessagePayload;
    }
  | {
      type: "ping";
      id: string;
      timestamp: number;
    }
  | {
      type: "pong";
      id: string;
      timestamp: number;
    }
  | {
      type: "flash_command";
      id: string;
      timestamp: number;
      payload: FlashCommandPayload;
    }
  | {
      type: "clear_command";
      id: string;
      timestamp: number;
      payload: ClearCommandPayload;
    };

export interface ConnectedClientInfo {
  client_id: string;
  name: string;
  monitor_ids: number[];
}

export interface VirtualMonitor {
  id: number;
  name: string;
  description?: string;
  color?: string;
}

export interface ServerTemplate {
  id: string;
  content: string;
  priority: Priority;
}

export interface ClientTemplate {
  id: string;
  content: string;
  feedback_type: FeedbackType;
}

export interface TemplateConfig {
  server_templates: ServerTemplate[];
  client_templates: ClientTemplate[];
}
