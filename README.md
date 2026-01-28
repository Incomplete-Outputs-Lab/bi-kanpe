# Bi-Kanpe

A bidirectional cue card system for event management with WebSocket-based real-time communication between director (server) and casters (clients).

## Prerequisites

- Rust 1.70+
- Node.js 16+

## Build & Run

Development mode:
```bash
cd app
npm install
npm run tauri dev
```

Production build:
```bash
cd app
npm run tauri build
```

## Documentation

See [CLAUDE.md](CLAUDE.md) for architecture, protocol details, and development guidelines.
