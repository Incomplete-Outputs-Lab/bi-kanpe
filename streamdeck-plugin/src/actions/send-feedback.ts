/**
 * Send Feedback Action
 * Allows users to send custom feedback messages to the director
 */

import streamDeck, { action, SingletonAction, WillAppearEvent, WillDisappearEvent, KeyDownEvent, DidReceiveSettingsEvent } from '@elgato/streamdeck';
import { z } from 'zod';
import { BiKanpeClient } from '../ws-client';

// Zod schema for settings validation
const SendFeedbackSettingsSchema = z.object({
  serverAddress: z.string().optional(),
  content: z.string().optional(),
  feedbackType: z.enum(['Ack', 'Question', 'Issue', 'Info']).optional(),
});

type SendFeedbackSettings = z.infer<typeof SendFeedbackSettingsSchema>;

@action({ UUID: 'com.misei.bi-kanpe.send-feedback' })
export class SendFeedbackAction extends SingletonAction<SendFeedbackSettings> {
  override async onWillAppear(ev: WillAppearEvent<SendFeedbackSettings>): Promise<void> {
    console.log('[SendFeedbackAction] onWillAppear triggered');
    console.log('[SendFeedbackAction] Settings:', JSON.stringify(ev.payload.settings));
    
    // Validate settings with zod
    const parseResult = SendFeedbackSettingsSchema.safeParse(ev.payload.settings);
    if (!parseResult.success) {
      console.error('[SendFeedbackAction] Invalid settings:', parseResult.error);
      return ev.action.setTitle('Invalid Settings');
    }

    const settings = parseResult.data;
    console.log('[SendFeedbackAction] Validated settings:', JSON.stringify(settings));
    
    // Use default server address if not set
    const serverAddress = settings.serverAddress || 'localhost:9877';
    console.log('[SendFeedbackAction] Initializing client with address:', serverAddress);
    await this.initializeClient(serverAddress);

    const title = settings.content ? settings.content.substring(0, 20) : 'Send Feedback';
    console.log('[SendFeedbackAction] Setting title:', title);
    return ev.action.setTitle(title);
  }

  override async onKeyDown(ev: KeyDownEvent<SendFeedbackSettings>): Promise<void> {
    console.log('[SendFeedbackAction] Button pressed! onKeyDown triggered');
    console.log('[SendFeedbackAction] Current settings:', JSON.stringify(ev.payload.settings));
    
    // Validate settings with zod
    const parseResult = SendFeedbackSettingsSchema.safeParse(ev.payload.settings);
    if (!parseResult.success) {
      console.error('[SendFeedbackAction] Invalid settings:', parseResult.error);
      await ev.action.showAlert();
      return;
    }

    const settings = parseResult.data;

    if (!settings.content) {
      console.error('[SendFeedbackAction] No content configured');
      await ev.action.showAlert();
      return;
    }

    // Use default server address if not set
    const serverAddress = settings.serverAddress || 'localhost:9877';

    const client = BiKanpeClient.getInstance();

    console.log('[SendFeedbackAction] Checking client connection...');
    // Initialize client if not already connected
    if (!client.isConnected()) {
      console.log('[SendFeedbackAction] Client not connected, initializing...');
      await this.initializeClient(serverAddress);
    } else {
      console.log('[SendFeedbackAction] Client already connected');
    }

    // Send feedback
    try {
      console.log('[SendFeedbackAction] Sending feedback:', {
        type: 'send_feedback',
        content: settings.content,
        feedback_type: settings.feedbackType || 'Info',
      });
      
      await client.send({
        type: 'send_feedback',
        content: settings.content,
        feedback_type: settings.feedbackType || 'Info',
      });

      console.log('[SendFeedbackAction] Feedback sent successfully');
      await ev.action.showOk();
    } catch (error) {
      console.error('[SendFeedbackAction] Failed to send feedback:', error);
      await ev.action.showAlert();
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<SendFeedbackSettings>): Promise<void> {
    // Validate settings with zod
    const parseResult = SendFeedbackSettingsSchema.safeParse(ev.payload.settings);
    if (!parseResult.success) {
      console.error('[SendFeedbackAction] Invalid settings:', parseResult.error);
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
    return ev.action.setTitle(settings.content ? settings.content.substring(0, 20) : 'Send Feedback');
  }

  override onWillDisappear(ev: WillDisappearEvent<SendFeedbackSettings>): void {
    // Clean up when action is removed
    // Note: Don't disconnect the singleton client as other actions may be using it
  }

  /**
   * Initialize the WebSocket client
   */
  private async initializeClient(serverAddress: string): Promise<void> {
    console.log('[SendFeedbackAction] initializeClient called with address:', serverAddress);
    
    const client = BiKanpeClient.getInstance();
    
    try {
      // Connect if not already connected
      if (!client.isConnected()) {
        console.log('[SendFeedbackAction] Attempting to connect...');
        await client.connect(serverAddress);
        console.log('[SendFeedbackAction] Connected successfully');
      } else {
        console.log('[SendFeedbackAction] Already connected');
      }
    } catch (error) {
      console.error('[SendFeedbackAction] Failed to connect:', error);
      throw error;
    }
  }
}
