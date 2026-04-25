# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Caribbean is an OpenClaw cluster management system using a lightweight Agent + centralized Server architecture with WebSocket real-time communication. It monitors distributed OpenClaw nodes, provides a React dashboard for management, and supports remote gateway lifecycle commands.

## Architecture

### Monorepo Structure (pnpm workspaces)

```
caribbean/
├── apps/
│   ├── server/         # @openclaw-caribbean/server (Fastify + ws + embedded web UI)
│   ├── agent/          # @openclaw-caribbean/agent (WebSocket client + status collector)
│   └── web/            # Private React/Vite dashboard (built into server dist/web/)
├── packages/
│   ├── shared/         # @openclaw-caribbean/shared (shared types: NodeInfo, NodeStatus)
│   └── protocol/       # @openclaw-caribbean/protocol (WebSocket message types)
```

### Communication Flow

1. **Agent → Server**: Periodic `heartbeat` messages (30s interval) containing:
   - System metrics (CPU, memory, uptime)
   - OpenClaw Gateway status (running/stopped/error, detected via HTTP health check)
   - Active agents list and available skills

2. **Server → Agent**: `command` messages for remote execution:
   - `openclaw_gateway_start/stop` - Start/stop gateway via `execSync`
   - `read_config` - Read `~/.openclaw/openclaw.json`
   - `read_logs` - Last 20 lines of OpenClaw logs
   - `gateway_health_check` - Run `openclaw gateway call health`
   - `fix_openclaw_config` - Auto-fix configuration issues

3. **Agent → Server**: `result` messages with command execution results

### Node State Management

- **First connection**: Server creates new node record with client-provided name, tags, IP, system type
- **Reconnection**: Server loads existing `name`, `tags`, `clientIp`, `system` from database, only updates `connected` and `last_seen`
- **Disconnection**: Server sets `connected = false`, `openclaw_status = "unknown"`
- Custom node names set in Web Dashboard persist across server restarts

### Why Not Next.js?

The current stack (Fastify + ws + Vite + React) is intentional:
- Next.js doesn't natively support WebSocket on the same port/process
- Current setup achieves single-process, dual-port (:3000 HTTP, :8080 WebSocket) deployment
- Fastify is faster than Next.js API routes for high-frequency monitoring
- Vite provides faster development builds than Next.js webpack/turbopack

## Build System

### Build Order

Dependencies must be built in order: `shared → protocol → web → server → agent`

### TypeScript Configuration

- Target: ES2022, Module: ESNext, Resolution: bundler
- All packages use `tsc` for compilation (no bundler for server/agent)
- Web app uses Vite for bundling
- Output: `dist/` with declarations and source maps

### Building Web Dashboard into Server

The web dashboard is statically built and embedded into the server:

```bash
cd apps/server
pnpm run build:all  # Builds web, copies to dist/web/, builds server
```

Production server serves pre-built web assets from `dist/web/` at `:3000`.

## Development Commands

### Quick Start

```bash
./start.sh              # Build all, start server + agent in background
./build-all.sh          # Build all packages (no start)
```

### Individual Development

```bash
pnpm --filter './packages/**' build    # Build shared packages
pnpm --filter './apps/**' build        # Build all apps
pnpm dev                                # Start dev servers for all apps

# Web dashboard dev server (hot-reload at :5173)
cd apps/web && pnpm dev

# Server development
cd apps/server && pnpm dev             # tsc --watch
npm start                               # Start built server

# Agent development
cd apps/agent && pnpm dev              # tsc --watch
npm start                               # Start built agent
```

### Service Management

```bash
# Server CLI
caribbean-server init                   # Initialize configuration
caribbean-server start                  # Start server (background)
caribbean-server stop/status/logs       # Control server

# Agent CLI
caribbean-agent init --server ws://...  # Initialize with server URL
caribbean-agent start                   # Start agent (background)
caribbean-agent stop/status/logs        # Control agent

# Root-level shortcuts
pnpm server:start/stop/status/logs
pnpm agent:start/stop/status/logs
```

### Testing

```bash
pnpm test                    # Run all tests
pnpm test:watch              # Watch mode
pnpm test:coverage           # Coverage report
cd packages/shared && pnpm test  # Run single workspace
```

- Framework: Vitest with globals enabled
- Test files: `src/__tests__/*.test.ts`
- Config: `vitest.config.ts` (root)

### Endpoints

- Production: `http://localhost:3000` (API + Web UI), `ws://localhost:8080/ws/agent`
- Dev mode: `http://localhost:5173` (web dev server), API/WebSocket from server

## Publishing

```bash
./publish.sh 0.1.14    # Bump versions, build, publish to npm, revert workspace deps
```

The script:
1. Bumps all package versions
2. Replaces `workspace:*` with actual version
3. Builds in dependency order
4. Publishes shared → protocol → server → agent
5. Reverts to `workspace:*` for local development

## Key Implementation Details

### WebSocket Message Protocol

Defined in `packages/protocol/src/messages.ts`:
- `heartbeat` - Agent → Server status report
- `command` - Server → Agent remote execution
- `result` - Agent → Server command result
- `connect` - Agent → Server connection registration
- `connected` - Server → Agent acknowledgment

### OpenClaw Gateway Status Detection

Agent-side via `collector.ts`:
```bash
curl -s -o /dev/null -w "%{http_code}" \
  --connect-timeout 3 --max-time 5 \
  "http://localhost:8000/api/gateway/status"
```
- Returns `'running'` or `'stopped'`
- Reported in every heartbeat message
- Server stores in `nodes.openclaw_status` and `status_history` table

### Database Schema (SQLite)

- `nodes` table: Node registry with `name`, `tags`, `clientIp`, `system`, `connected`, `openclaw_status`, `last_seen`
- `status_history` table: Time-series data (last 5 records per node)
- `migrations` table: Schema version tracking
- Auto-migration on server startup

### Adding New Migrations

In `apps/server/src/database.ts`, add to `getMigrations()`:
```typescript
{
  version: 3,
  name: 'add_new_column',
  up: `ALTER TABLE nodes ADD COLUMN new_field TEXT;`
}
```

### Remote Command Flow

1. Web Dashboard → POST `/api/nodes/:id/command`
2. Server → WebSocket `command` message to agent
3. Agent → `execSync` with 30s timeout
4. Agent → WebSocket `result` message
5. Agent triggers immediate heartbeat with updated status
6. Dashboard polls `/api/nodes` every 10s → reflects change

## Component Development

### Adding Settings to Web Dashboard

In `apps/web/src/components/Settings.tsx`:
1. Add fields to `settings` state
2. Add UI controls in JSX
3. Add validation in `handleSave`
4. Update API calls
5. Add i18n translations in `i18n/zh.json` and `i18n/en.json`

### Adding New WebSocket Commands

1. Add message type to `packages/protocol/src/messages.ts`
2. Add handler in `apps/agent/src/websocket.ts` `executeCommand()`
3. Add API endpoint in `apps/server/src/api.ts`
4. Update `docs/protocol.md`

## Important Notes

- Node names are permanently saved in database and never overwritten by reconnection
- Agent sends immediate heartbeat on connection (don't wait for first interval)
- Server runs in-memory node registry + SQLite persistence
- Agent automatically detects local IP and OS type (windows/mac/linux)
- Gateway status becomes "unknown" when node disconnects
- The `build:web` script cleans `dist/web` before copying to prevent stale files
