// TypeScript types matching Rust message types

export type Priority = "normal" | "high" | "urgent";
export type FeedbackType = "ack" | "question" | "issue" | "info";

export type TimerState = "pending" | "running" | "paused" | "completed" | "cancelled";

export interface ClientHelloPayload {
  client_name: string;
  display_monitor_ids: string[];
}

export interface ServerWelcomePayload {
  server_name: string;
  assigned_client_id: string;
}

export interface KanpeMessagePayload {
  content: string;
  target_monitor_ids: string[];
  priority: Priority;
}

export interface FeedbackMessagePayload {
  content: string;
  client_name: string;
  reply_to_message_id: string;
  feedback_type: FeedbackType;
}

export interface FlashCommandPayload {
  target_monitor_ids: string[];
}

export interface ClearCommandPayload {
  target_monitor_ids: string[];
}

export interface TimerDefinition {
  id: string;
  name: string;
  target_monitor_ids: string[];
  duration_ms: number;
  scheduled_start_timestamp_ms?: number | null;
  /** 指定した終了時刻までカウントダウンする場合の Unix ミリ秒 */
  target_end_timestamp_ms?: number | null;
}

export interface TimerRuntimeState {
  id: string;
  state: TimerState;
  started_at_timestamp_ms?: number | null;
  paused_at_timestamp_ms?: number | null;
  remaining_ms: number;
  last_updated_timestamp_ms: number;
}

export interface TimerEntry {
  definition: TimerDefinition;
  runtime: TimerRuntimeState;
}

export interface TimerStateSnapshot {
  timestamp_ms: number;
  timers: TimerEntry[];
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
  monitor_ids: string[];
}

export interface VirtualMonitor {
  id: string;
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
