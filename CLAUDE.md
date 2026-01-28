# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bi-Kanpe is a bidirectional cue card (kanpe) system for event management. It enables real-time communication between a director (server) and multiple casters (clients) over WebSocket connections on a local network. The system supports virtual monitor routing, priority levels, and bidirectional feedback.

## Architecture

### Workspace Structure

This is a Rust cargo workspace with three core crates and a Tauri desktop application:

```
bi-kanpe/
├── crates/
│   ├── kanpe-core/      # Protocol definitions & message types (no I/O)
│   ├── kanpe-server/    # WebSocket server for director mode
│   └── kanpe-client/    # WebSocket client for caster mode
└── app/                 # Tauri desktop application
    ├── src-tauri/       # Rust backend (Tauri commands, state management)
    └── src/             # React frontend (UI components, hooks)
```

### Key Architectural Concepts

**Virtual Monitors vs Physical Clients:**
- Virtual monitors are logical message destinations (e.g., "Actor A", "Host") identified by IDs (1-4)
- Physical clients are actual application instances that can display one or multiple virtual monitors
- Monitor ID `0` means broadcast to all monitors
- Clients receive all messages via WebSocket but filter display based on configured `display_monitor_ids`
- Multiple clients can display the same virtual monitor (redundancy)
- One client can display multiple virtual monitors (multi-role scenarios)

**Message Flow:**
1. Server broadcasts all messages to all connected clients over WebSocket
2. Clients filter messages on their side based on `target_monitor_ids` matching their `display_monitor_ids`
3. Feedback flows from client back to server with `source_monitor_id` to identify the origin

**Crate Boundaries:**
- `kanpe-core`: Pure message protocol (serde types, no I/O)
- `kanpe-server`: WebSocket server, client management, broadcast system
- `kanpe-client`: WebSocket client connection management
- `app/src-tauri`: Tauri integration layer (commands, state, event emission to frontend)
- `app/src`: React UI (mode selector, server view, client view)

## Build & Development Commands

### Prerequisites
- Rust 1.70+
- Node.js 16+

### Development Mode
```bash
cd app
npm install
npm run tauri dev
```

### Production Build
```bash
cd app
npm run tauri build
```
Output will be in `app/src-tauri/target/release/`

### Testing
Run all workspace tests:
```bash
cargo test --workspace
```

Run tests for a specific crate:
```bash
cargo test -p kanpe-core
cargo test -p kanpe-server
cargo test -p kanpe-client
```

### Building Individual Crates
```bash
cargo build -p kanpe-core
cargo build -p kanpe-server
cargo build -p kanpe-client
```

## Protocol & Message Types

All protocol types are defined in `crates/kanpe-core/src/`:
- `message.rs`: `Message` enum with all protocol message types (ClientHello, ServerWelcome, KanpeMessage, FeedbackMessage, Ping, Pong)
- `types.rs`: `Priority` enum (Normal, High, Urgent), `FeedbackType` enum (Ack, Question, Issue, Info)

Messages use serde with `#[serde(tag = "type", rename_all = "snake_case")]` for JSON serialization.

Helper functions in `types.rs`:
- `new_id()`: Generate UUID v4 for message IDs
- `timestamp()`: Get current Unix timestamp in milliseconds

## Tauri Integration

### Commands (app/src-tauri/src/commands/)

**Server Commands:**
- `start_server(port: u16)` - Start WebSocket server
- `stop_server()` - Stop server
- `send_kanpe_message(target_monitor_ids: Vec<u32>, content: String, priority: String)` - Send message
- `get_connected_clients()` - Get list of connected clients

**Client Commands:**
- `connect_to_server(address: String, client_name: String, display_monitor_ids: Vec<u32>, feedback_monitor_id: u32)` - Connect to server
- `disconnect_from_server()` - Disconnect from server
- `send_feedback(content: String, feedback_type: String, reply_to_message_id: Option<String>)` - Send feedback to director

### State Management (app/src-tauri/src/state.rs)

`AppState` manages both server and client instances using `Arc<Mutex<>>` wrappers:
- `server: Arc<Mutex<Option<KanpeServer>>>`
- `client: Arc<Mutex<Option<KanpeClient>>>`

### Events (Rust → Frontend)

**Server Events:**
- `client-connected` - New client connected
- `client-disconnected` - Client disconnected
- `feedback-received` - Feedback from client

**Client Events:**
- `connection-established` - Connected to server
- `connection-lost` - Disconnected from server
- `kanpe-message-received` - Received cue card message

## Frontend Structure (app/src/)

- `App.tsx`: Root component with mode selection
- `components/ModeSelector.tsx`: Choose between Director and Caster mode
- `components/ServerView.tsx`: Director UI (send messages, view clients, receive feedback)
- `components/ClientView.tsx`: Caster UI (display messages, send feedback)
- `hooks/useServerState.ts`: Hook for server state and Tauri event listeners
- `hooks/useClientState.ts`: Hook for client state and Tauri event listeners
- `types/messages.ts`: TypeScript types matching Rust protocol types

## Important Implementation Notes

### Message Filtering Logic
Clients should display a message if:
1. `target_monitor_ids` contains `0` (broadcast), OR
2. `target_monitor_ids` intersects with client's `display_monitor_ids`

### WebSocket Connection
- Default port: 9876
- Address format: `hostname:port` or `ip:port`
- All communication uses JSON text frames
- Ping/Pong keepalive maintains connections

### Priority Handling
Priority levels affect UI presentation:
- `Normal`: Standard display
- `High`: Emphasized styling
- `Urgent`: Maximum attention (color/size changes)

## Testing Guidelines

### Manual Testing Scenarios
1. Start one server instance
2. Start 2-3 client instances with different monitor IDs
3. Test broadcast (target ID 0) - should appear on all clients
4. Test specific routing (target ID 1) - should only appear on clients monitoring ID 1
5. Test feedback - verify it appears in server's feedback panel with correct source monitor ID
6. Test disconnect handling - close client and verify server updates client list

### Unit Test Coverage
- Message serialization/deserialization (see `kanpe-core/src/message.rs` tests)
- Priority and FeedbackType enum serialization
- UUID generation and timestamp utilities

## Future Phases

Reference `kanpe_app_spec.md` for detailed specifications. Planned features include:
- Phase 2: Message history, read receipts, auto-reconnect, config persistence
- Phase 3: Template system for common messages
- Phase 4: Stream Deck integration via REST API

## Common Development Tasks

### Adding a New Message Type
1. Add variant to `Message` enum in `kanpe-core/src/message.rs`
2. Create payload struct with serde derives
3. Add constructor method on `Message` impl
4. Update server/client handlers if needed
5. Add TypeScript type in `app/src/types/messages.ts`
6. Add unit tests for serialization

### Adding a New Tauri Command
1. Define command function in `app/src-tauri/src/commands/`
2. Add to `invoke_handler` in `app/src-tauri/src/lib.rs`
3. Call from frontend using `invoke('command_name', { args })`
4. Handle errors using `Result<T, String>` return type

### Emitting Events to Frontend
```rust
app_handle.emit("event-name", event_payload)?;
```
Listen in React:
```typescript
import { listen } from '@tauri-apps/api/event';
const unlisten = await listen('event-name', (event) => { /* handle */ });
```
