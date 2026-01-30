/**
 * React to Latest Action
 * Sends a quick reaction to the most recent message received
 */

import streamDeck, { action, SingletonAction, WillAppearEvent, WillDisappearEvent, KeyDownEvent, DidReceiveSettingsEvent } from '@elgato/streamdeck';
import { z } from 'zod';
import { BiKanpeClient, StreamDeckResponse } from '../ws-client';

// Zod schema for settings validation
const ReactToLatestSettingsSchema = z.object({
  serverAddress: z.string().optional(),
  feedbackType: z.enum(['Ack', 'Question', 'Issue', 'Info']).optional(),
});

type ReactToLatestSettings = z.infer<typeof ReactToLatestSettingsSchema>;

@action({ UUID: 'com.misei.bi-kanpe.react-to-latest' })
export class ReactToLatestAction extends SingletonAction<ReactToLatestSettings> {
  private hasNewMessage: boolean = false;
  private stateCheckInterval: NodeJS.Timeout | null = null;

  override async onWillAppear(ev: WillAppearEvent<ReactToLatestSettings>): Promise<void> {
    console.log('[ReactToLatestAction] onWillAppear triggered');
    console.log('[ReactToLatestAction] Settings:', JSON.stringify(ev.payload.settings));
    
    // Validate settings with zod
    const parseResult = ReactToLatestSettingsSchema.safeParse(ev.payload.settings);
    if (!parseResult.success) {
      console.error('[ReactToLatestAction] Invalid settings:', parseResult.error);
      return ev.action.setTitle('Invalid Settings');
    }

    const settings = parseResult.data;
    console.log('[ReactToLatestAction] Validated settings:', JSON.stringify(settings));
    
    // Use default server address if not set
    const serverAddress = settings.serverAddress || 'localhost:9877';
    console.log('[ReactToLatestAction] Initializing client with address:', serverAddress);
    await this.initializeClient(serverAddress);

    // Set title based on feedback type
    const title = this.getFeedbackTypeLabel(settings.feedbackType || 'Ack');
    console.log('[ReactToLatestAction] Setting title:', title);
    return ev.action.setTitle(title);
  }

  override async onKeyDown(ev: KeyDownEvent<ReactToLatestSettings>): Promise<void> {
    console.log('[ReactToLatestAction] Button pressed! onKeyDown triggered');
    console.log('[ReactToLatestAction] Current settings:', JSON.stringify(ev.payload.settings));
    
    // Validate settings with zod
    const parseResult = ReactToLatestSettingsSchema.safeParse(ev.payload.settings);
    if (!parseResult.success) {
      console.error('[ReactToLatestAction] Invalid settings:', parseResult.error);
      await ev.action.showAlert();
      return;
    }

    const settings = parseResult.data;

    // Use default server address if not set
    const serverAddress = settings.serverAddress || 'localhost:9877';

    const client = BiKanpeClient.getInstance();

    console.log('[ReactToLatestAction] Checking client connection...');
    // Initialize client if not already connected
    if (!client.isConnected()) {
      console.log('[ReactToLatestAction] Client not connected, initializing...');
      await this.initializeClient(serverAddress);
    } else {
      console.log('[ReactToLatestAction] Client already connected');
    }

    // Send reaction to latest message
    try {
      console.log('[ReactToLatestAction] Sending reaction:', {
        type: 'react_to_latest',
        feedback_type: settings.feedbackType || 'Ack',
      });
      
      await client.send({
        type: 'react_to_latest',
        feedback_type: settings.feedbackType || 'Ack',
      });

      console.log('[ReactToLatestAction] Reaction sent successfully');
      await ev.action.showOk();
      
      // Clear new message indicator
      this.hasNewMessage = false;
      await ev.action.setState(0);
      console.log('[ReactToLatestAction] State cleared');
    } catch (error) {
      console.error('[ReactToLatestAction] Failed to send reaction:', error);
      await ev.action.showAlert();
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ReactToLatestSettings>): Promise<void> {
    // Validate settings with zod
    const parseResult = ReactToLatestSettingsSchema.safeParse(ev.payload.settings);
    if (!parseResult.success) {
      console.error('[ReactToLatestAction] Invalid settings:', parseResult.error);
      return ev.action.setTitle('Invalid Settings');
    }

    const settings = parseResult.data;

    // Use default server address if not set
    const serverAddress = settings.serverAddress || 'localhost:9877';

    const client = BiKanpeClient.getInstance();

    // Reconnect if not already connected
    if (!client.isConnected()) {
      await this.initializeClient(serverAddress);
    }

    // Update title
    const title = this.getFeedbackTypeLabel(settings.feedbackType || 'Ack');
    return ev.action.setTitle(title);
  }

  override onWillDisappear(ev: WillDisappearEvent<ReactToLatestSettings>): void {
    // Clean up when action is removed
    if (this.stateCheckInterval) {
      clearInterval(this.stateCheckInterval);
      this.stateCheckInterval = null;
    }
    
    // Note: Don't disconnect the singleton client as other actions may be using it
  }

  /**
   * Initialize the WebSocket client
   */
  private async initializeClient(serverAddress: string): Promise<void> {
    console.log('[ReactToLatestAction] initializeClient called with address:', serverAddress);
    
    const client = BiKanpeClient.getInstance();
    
    try {
      // Connect if not already connected
      if (!client.isConnected()) {
        console.log('[ReactToLatestAction] Attempting to connect...');
        await client.connect(serverAddress);
        console.log('[ReactToLatestAction] Connected successfully');
      } else {
        console.log('[ReactToLatestAction] Already connected');
      }

      // Listen for state updates
      client.onMessage((response: StreamDeckResponse) => {
        console.log('[ReactToLatestAction] Received message:', JSON.stringify(response));
        if (response.type === 'state_update' && response.latest_message) {
          console.log('[ReactToLatestAction] New message detected, updating state');
          // Show alert state when new message arrives
          this.hasNewMessage = true;
        }
      });

      // Periodically check state
      if (this.stateCheckInterval) {
        clearInterval(this.stateCheckInterval);
      }

      console.log('[ReactToLatestAction] Starting state check interval');
      this.stateCheckInterval = setInterval(async () => {
        if (client.isConnected()) {
          try {
            await client.send({ type: 'get_state' });
          } catch (error) {
            console.error('[ReactToLatestAction] Failed to get state:', error);
          }
        }
      }, 5000); // Check every 5 seconds
    } catch (error) {
      console.error('[ReactToLatestAction] Failed to connect:', error);
      throw error;
    }
  }

  /**
   * Get label for feedback type
   */
  private getFeedbackTypeLabel(type: string): string {
    switch (type) {
      case 'Ack':
        return '了解';
      case 'Question':
        return '質問';
      case 'Issue':
        return '問題';
      case 'Info':
        return '情報';
      default:
        return 'React';
    }
  }
}
