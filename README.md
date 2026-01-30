# Bi-Kanpe

A bidirectional cue card system for event management with WebSocket-based real-time communication between director (server) and casters (clients).

## Features

- **Director Mode**: Send cue cards to multiple casters with priority levels
- **Caster Mode**: Receive cue cards and send feedback to the director
- **Virtual Monitors**: Route messages to specific virtual displays
- **StreamDeck Integration**: Control feedback and reactions directly from StreamDeck

## Prerequisites

- Rust 1.70+
- Node.js 16+

## Build & Run

### Main Application

Development mode:
```bash
cd app
bun install
bun run tauri dev
```

Production build:
```bash
cd app
bun run tauri build
```

### StreamDeck Plugin

Build the StreamDeck plugin:
```bash
cd streamdeck-plugin
bun install
bun run build
```

## Documentation

- [CLAUDE.md](CLAUDE.md) - Architecture, protocol details, and development guidelines
- [streamdeck-plugin/README.md](streamdeck-plugin/README.md) - StreamDeck plugin documentation
