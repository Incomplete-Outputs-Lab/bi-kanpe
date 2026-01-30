/**
 * WebSocket client for connecting to Bi-Kanpe caster app
 */

import WebSocket from 'ws';

// WebSocket types for Node.js environment
type WebSocketInstance = WebSocket;

interface WebSocketConstructor {
  new(url: string): WebSocketInstance;
  readonly CONNECTING: 0;
  readonly OPEN: 1;
  readonly CLOSING: 2;
  readonly CLOSED: 3;
}

// Get WebSocket constructor
function getWebSocket(): WebSocketConstructor {
  return WebSocket as unknown as WebSocketConstructor;
}

export interface StreamDeckRequest {
  type: 'send_feedback' | 'react_to_latest' | 'get_state';
  content?: string;
  feedback_type?: string;
}

export interface StreamDeckResponse {
  type: 'result' | 'state_update';
  success?: boolean;
  error?: string;
  connected?: boolean;
  latest_message?: {
    id: string;
    content: string;
    priority: string;
    target_monitor_ids: string[];
  };
  monitors?: Array<{
    id: string;
    name: string;
    color: string;
  }>;
}

export class BiKanpeClient {
  private ws: WebSocketInstance | null = null;
  private serverAddress: string = '';
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageHandlers: Array<(response: StreamDeckResponse) => void> = [];
  private connectionStateHandlers: Array<(connected: boolean) => void> = [];
  private static instance: BiKanpeClient | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): BiKanpeClient {
    if (!BiKanpeClient.instance) {
      BiKanpeClient.instance = new BiKanpeClient();
    }
    return BiKanpeClient.instance;
  }

  /**
   * Connect to the Bi-Kanpe caster app
   */
  connect(serverAddress: string): Promise<void> {
    console.log('[BiKanpeClient] connect() called with address:', serverAddress);
    this.serverAddress = serverAddress;
    
    return new Promise((resolve, reject) => {
      try {
        // Ensure ws:// protocol and /ws path
        let url: string;
        if (serverAddress.startsWith('ws://') || serverAddress.startsWith('wss://')) {
          url = serverAddress;
        } else {
          url = `ws://${serverAddress}`;
        }
        
        // Add /ws path if not already present
        if (!url.endsWith('/ws')) {
          url = `${url}/ws`;
        }

        console.log('[BiKanpeClient] Creating WebSocket connection to:', url);
        const WS = getWebSocket();
        this.ws = new WS(url);

        this.ws.onopen = () => {
          console.log('[BiKanpeClient] ✅ Connected successfully to', url);
          this.notifyConnectionState(true);
          resolve();
        };

        this.ws.onerror = (error) => {
          console.error('[BiKanpeClient] ❌ WebSocket error:', error);
          this.notifyConnectionState(false);
          reject(new Error('Failed to connect to Bi-Kanpe server'));
        };

        this.ws.onclose = (event) => {
          console.log('[BiKanpeClient] Connection closed');
          console.log('[BiKanpeClient] Close code:', event.code);
          console.log('[BiKanpeClient] Close reason:', event.reason);
          console.log('[BiKanpeClient] Was clean:', event.wasClean);
          this.notifyConnectionState(false);
          this.scheduleReconnect();
        };

        this.ws.onmessage = (event) => {
          const data = event.data.toString();
          console.log('[BiKanpeClient] Received message:', data);
          try {
            const response: StreamDeckResponse = JSON.parse(data);
            console.log('[BiKanpeClient] Parsed message:', JSON.stringify(response));
            this.handleMessage(response);
          } catch (error) {
            console.error('[BiKanpeClient] Failed to parse message:', error);
            console.error('[BiKanpeClient] Raw message data:', data);
          }
        };
      } catch (error) {
        console.error('[BiKanpeClient] Exception during connect:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send a request to the server
   */
  send(request: StreamDeckRequest): Promise<void> {
    console.log('[BiKanpeClient] send() called with request:', JSON.stringify(request));
    return new Promise((resolve, reject) => {
      const WS = getWebSocket();
      if (!this.ws || this.ws.readyState !== WS.OPEN) {
        console.error('[BiKanpeClient] Cannot send: WebSocket not connected');
        console.error('[BiKanpeClient] WebSocket state:', this.ws ? this.ws.readyState : 'null');
        reject(new Error('Not connected to server'));
        return;
      }

      try {
        const message = JSON.stringify(request);
        console.log('[BiKanpeClient] Sending message:', message);
        this.ws.send(message);
        console.log('[BiKanpeClient] Message sent successfully');
        resolve();
      } catch (error) {
        console.error('[BiKanpeClient] Failed to send message:', error);
        reject(error);
      }
    });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    const WS = getWebSocket();
    return this.ws !== null && this.ws.readyState === WS.OPEN;
  }

  /**
   * Register a message handler
   */
  onMessage(handler: (response: StreamDeckResponse) => void): void {
    console.log('[BiKanpeClient] Registering message handler, total handlers:', this.messageHandlers.length + 1);
    this.messageHandlers.push(handler);
  }

  /**
   * Register a connection state handler
   */
  onConnectionStateChange(handler: (connected: boolean) => void): void {
    this.connectionStateHandlers.push(handler);
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(response: StreamDeckResponse): void {
    console.log('[BiKanpeClient] handleMessage() called, handlers count:', this.messageHandlers.length);
    this.messageHandlers.forEach((handler, index) => {
      try {
        console.log('[BiKanpeClient] Calling handler', index);
        handler(response);
      } catch (error) {
        console.error('[BiKanpeClient] Error in message handler', index, ':', error);
      }
    });
  }

  /**
   * Notify connection state change
   */
  private notifyConnectionState(connected: boolean): void {
    this.connectionStateHandlers.forEach(handler => {
      try {
        handler(connected);
      } catch (error) {
        console.error('[BiKanpeClient] Error in connection state handler:', error);
      }
    });
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isConnected() && this.serverAddress) {
        console.log('[BiKanpeClient] Attempting to reconnect...');
        this.connect(this.serverAddress).catch(error => {
          console.error('[BiKanpeClient] Reconnection failed:', error);
        });
      }
    }, 5000); // Reconnect after 5 seconds
  }
}
