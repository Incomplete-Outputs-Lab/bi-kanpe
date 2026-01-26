# Bi-Kanpe

A bidirectional cue card (kanpe) system for event management with WebSocket-based real-time communication between director (server) and casters (clients).

## Features

### Phase 1 (Current Implementation)

- **Dual-Mode Operation**: Run as either Director (Server) or Caster (Client)
- **WebSocket Communication**: Real-time message delivery over WebSocket
- **Virtual Monitor Routing**: Target specific virtual monitors or broadcast to all
- **Priority Levels**: Normal, High, and Urgent message priorities
- **Feedback System**: Clients can send acknowledgments, questions, issues, or info back to the director
- **Multi-Client Support**: Server supports multiple simultaneous client connections

## Architecture

The project is organized as a Rust cargo workspace with the following structure:

```
bi-kanpe/
├── crates/
│   ├── kanpe-core/      # Core protocol types and messages
│   ├── kanpe-server/    # WebSocket server implementation
│   └── kanpe-client/    # WebSocket client implementation
└── app/                 # Tauri desktop application
    ├── src-tauri/       # Rust backend (Tauri integration)
    └── src/             # React frontend
```

## Building

### Prerequisites

- Rust 1.70 or later
- Node.js 16 or later
- npm or pnpm

### Development Build

1. Install frontend dependencies:
   ```bash
   cd app
   npm install
   ```

2. Build and run in development mode:
   ```bash
   npm run tauri dev
   ```

### Production Build

```bash
cd app
npm run tauri build
```

The compiled application will be in `app/src-tauri/target/release/`.

## Usage

### Director (Server) Mode

1. Launch the application and select "Director (Server)" mode
2. Click "Start Server" (default port: 9876)
3. Wait for casters to connect (they will appear in the "Connected Clients" list)
4. Compose messages:
   - Enter message content
   - Select target monitor IDs (or "All" for broadcast)
   - Choose priority level
   - Click "Send Message"
5. View feedback from casters in the "Feedback" panel

### Caster (Client) Mode

1. Launch the application and select "Caster (Client)" mode
2. Configure connection:
   - Enter server address (e.g., `localhost:9876` or `192.168.1.100:9876`)
   - Enter your client name
   - Select which monitor IDs you want to display
   - Choose which monitor ID to use for feedback
3. Click "Connect to Server"
4. Messages targeted to your monitor IDs will appear in large text
5. Send feedback using the buttons at the bottom:
   - ✓ Acknowledge
   - ? Question
   - ⚠ Issue
   - ℹ Info

## Protocol

### Message Types

- **ClientHello**: Sent by client on connection to introduce itself
- **ServerWelcome**: Sent by server to confirm connection and assign client ID
- **KanpeMessage**: Cue card message from server to clients
- **FeedbackMessage**: Feedback from client to server
- **Ping/Pong**: Connection keepalive

All messages include:
- Unique UUID identifier
- Unix timestamp in milliseconds
- Type-specific payload

### Virtual Monitor IDs

- Monitor ID `0` = Broadcast to all monitors
- Monitor IDs `1-4` = Specific virtual monitors
- Clients can listen to multiple monitor IDs simultaneously
- Messages are filtered on the client side based on target IDs

## Testing

Run the test suite:

```bash
cargo test --workspace
```

### Manual Testing

1. Start one instance in Server mode
2. Start 2-3 instances in Client mode with different monitor IDs
3. Test message routing:
   - Send message to "All" (ID 0) - should appear on all clients
   - Send message to specific ID - should only appear on clients monitoring that ID
4. Test feedback:
   - Send feedback from client
   - Verify it appears in server's feedback panel with correct source monitor ID
5. Test disconnection handling:
   - Disconnect a client
   - Verify it's removed from server's client list

## Future Phases

- **Phase 2**: Message history, read receipts, auto-reconnect, configuration persistence
- **Phase 3**: Template system for commonly used messages
- **Phase 4**: Stream Deck integration via REST API

## License

See LICENSE file for details.
