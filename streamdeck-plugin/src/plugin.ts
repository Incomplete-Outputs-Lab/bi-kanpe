/**
 * Bi-Kanpe StreamDeck Plugin
 * Main entry point for the plugin
 */

import streamDeck from '@elgato/streamdeck';

// Import actions
import { SendFeedbackAction } from './actions/send-feedback';
import { ReactToLatestAction } from './actions/react-to-latest';

// Register actions and connect to Stream Deck
streamDeck.actions.registerAction(new SendFeedbackAction());
streamDeck.actions.registerAction(new ReactToLatestAction());

// Connect to Stream Deck
streamDeck.connect();
