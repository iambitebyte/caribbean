# Development Guide

## Prerequisites

- Node.js 18+ or Bun runtime
- pnpm package manager

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/caribbean.git
cd caribbean

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

---

## Project Structure

```
caribbean/
├── apps/
│   ├── agent/              # Node Agent
│   │   └── src/
│   │       ├── collector.ts    # Status collector
│   │       ├── config-fixer.ts # OpenClaw config fixer
│   │       ├── websocket.ts    # WebSocket client
│   │       ├── cli.ts          # CLI commands
│   │       └── index.ts        # Entry point
│   │
│   ├── server/             # Server
│   │   └── src/
│   │       ├── websocket-hub.ts    # WebSocket Hub
│   │       ├── api.ts              # REST API
│   │       ├── node-manager.ts     # Node management
│   │       ├── database.ts         # Database management
│   │       └── index.ts            # Entry point
│   │
│   └── web/                # Web Dashboard
│       └── src/
│           ├── components/          # UI components
│           │   ├── ui/             # shadcn/ui components
│           │   └── NodeCard.tsx    # Node card
│           ├── lib/                # Utility functions
│           ├── types/              # Type definitions
│           ├── App.tsx             # Main app
│           └── main.tsx            # Entry point
│
├── packages/
│   ├── shared/             # Shared type definitions
│   │   └── src/
│   │       ├── node.ts             # Node types (includes OpenClawGatewayStatus)
│   │       └── index.ts
│   └── protocol/           # Communication protocol specs
│
├── docs/                   # Documentation
├── docker/                 # Docker configuration
└── start.sh                # One-click startup script
```

---

## Development Workflow

### Start Server

```bash
cd apps/server
pnpm run build
npm start
```

### Start Agent (separate terminal)

```bash
cd apps/agent
pnpm run build
npm start
```

### Start Web Dashboard Dev Server (optional)

The Web Dashboard supports hot-reload during development:

```bash
cd apps/web
pnpm dev
```

Development mode endpoints:

| Service | URL |
|---------|-----|
| Web Dashboard (dev) | `http://localhost:5173` |
| Server (API + WebSocket) | `http://localhost:3000` |

### Production Build

Build the Web Dashboard into the Server for single-binary deployment:

```bash
cd apps/server
pnpm run build:all
npm start
```

Production mode endpoints:

| Service | Port |
|---------|------|
| REST API + Web UI | `http://localhost:3000` |
| WebSocket | `ws://localhost:8080` |

---

## Testing

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Lint
pnpm lint
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

### Guidelines

- Ensure TypeScript type checks pass
- All tests must pass
- Follow [Conventional Commits](https://conventionalcommits.org/)
