# Architecture

## Overview

Caribbean is an OpenClaw cluster management hub that provides real-time monitoring, unified management, and intelligent scheduling for distributed agent nodes. The project follows a monorepo structure with pnpm workspaces.

## Current Tech Stack

### Server (`apps/server`)

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **REST API** | Fastify 4.26+ | High-performance HTTP server for REST endpoints |
| **WebSocket** | ws 8.16+ | Raw WebSocket server for agent connections |
| **Database** | SQLite 5+ | Persistent storage for node states (keeps last 5 status records) |
| **Process Management** | Commander 12+ | CLI interface for service control |
| **Language** | TypeScript 5+ | Type-safe server implementation |

### Agent (`apps/agent`)

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **WebSocket Client** | ws 8.16+ | Persistent connection to server with auto-reconnect |
| **Status Collector** | Node.js | Collects system metrics and OpenClaw Gateway status |
| **Health Checks** | curl | Verifies OpenClaw Gateway availability (3s connect + 5s total timeout) |
| **Language** | TypeScript 5+ | Type-safe agent implementation |

### Web Dashboard (`apps/web`)

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Framework** | React 18 | UI library for dashboard |
| **Bundler** | Vite 5 | Fast development and production builds |
| **Styling** | Tailwind CSS 3 | Utility-first CSS framework |
| **Icons** | Lucide React | Icon library |
| **Language** | TypeScript 5+ | Type-safe frontend code |

### Shared Packages

| Package | Purpose |
|---------|---------|
| `@caribbean/shared` | Shared TypeScript types (NodeInfo, NodeStatus, etc.) |
| `@caribbean/protocol` | Wire protocol message types for WebSocket communication |

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Caribbean Server (Single Node.js Process)    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     WebSocketHub                          │  │
│  │                    (ws :8080)                             │  │
│  │  Path: /ws/agent                                         │  │
│  └─────────────────────┬────────────────────────────────────┘  │
│                        │                                       │
│  ┌─────────────────────▼────────────────────────────────────┐  │
│  │                     NodeManager                          │  │
│  │            (In-memory node registry)                    │  │
│  │  Map<string, NodeInfo>                                    │  │
│  │  Map<string, NodeStatus>                                  │  │
│  └─────────────────────┬────────────────────────────────────┘  │
│                        │                                       │
│  ┌─────────────────────▼────────────────────────────────────┐  │
│  │                      ApiServer                           │  │
│  │                   (Fastify :3000)                         │  │
│  │  - REST API endpoints (/api/*)                           │  │
│  │  - Static file serving (web dashboard)                   │  │
│  └─────────────────────┬────────────────────────────────────┘  │
│                        │                                       │
│  ┌─────────────────────▼────────────────────────────────────┐  │
│  │                  DatabaseManager                       │  │
│  │                   (SQLite)                               │  │
│  │  - nodes table (node registry)                          │  │
│  │  - status_history table (time-series, last 5 records)   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

         ▲                                           ▲
         │ WebSocket (ws://host:8080/ws/agent)      │ HTTP/Static (http://host:3000)
         │                                           │
         │                                           │
┌────────┴────────┐                          ┌──────┴─────────┐
│  Agent Nodes    │                          │  Web Browser   │
│  (ws clients)   │                          │  (React SPA)   │
└─────────────────┘                          └────────────────┘
```

## OpenClaw Gateway Status Verification

The system uses a distributed approach for monitoring OpenClaw Gateway status:

### Agent-Side Verification

Each Agent actively monitors its local OpenClaw Gateway:

```bash
# Agent runs this every heartbeat (30s)
curl -s -o /dev/null -w "%{http_code}" \
  --connect-timeout 3 \
  --max-time 5 \
  "http://localhost:8000/api/gateway/status"
```

- **Timeout**: 3s connect timeout, 5s total timeout
- **Status**: Returns `'running'` or `'stopped'`
- **Reporting**: Status included in every heartbeat message

### Server-Side Storage

Server receives Gateway status via heartbeat and stores:

- **Current status** in `nodes.openclaw_status`
- **History** in `status_history.openclaw_status`
- **Retention**: Only last 5 records per node

### Dashboard Display

Web Dashboard shows Gateway status with visual indicators:

- **Running** → Green badge with ⚡ icon
- **Stopped** → Red badge with ⚡ icon
- **Unknown** → Gray dash `-`

### Advantages of Agent-Side Verification

| Aspect | Agent-Side | Server-Side |
|---------|------------|-------------|
| **Accuracy** | ✅ Direct local access | ⚠️ Remote checks may fail |
| **Latency** | ✅ Instant detection | ⚠️ Network delays |
| **Complexity** | ✅ Simple and reliable | ❌ Hardcoded URLs |
| **Scalability** | ✅ Self-contained | ❌ Server bottleneck |

## Why Not Next.js?

### The Question

Since Caribbean serves both a web dashboard and a REST API from a single process, why not use Next.js which can handle both server and frontend in one project?

### The Short Answer

**Next.js doesn't natively support WebSocket on the same port or process.** To support agent WebSocket connections (port 8080) alongside the web dashboard (port 3000), you'd still need to run a separate WebSocket server or use a custom server setup. This defeats much of the purpose of using Next.js.

### Detailed Analysis

#### 1. WebSocket Limitation

Next.js uses its built-in WebSocket dev server for Hot Module Replacement (HMR). This is an internal implementation detail and **cannot be used for application-level WebSocket connections**.

To serve WebSocket endpoints (like `/ws/agent` for agent nodes), you have two options:

| Option | Description | Downsides |
|--------|-------------|-----------|
| **Custom Server** | Use Fastify/Express as a custom server, mounting both Next.js and ws | - Loses official Next.js deployment recommendations<br>- Cannot deploy to Vercel easily<br>- Complexity of integrating two frameworks |
| **Dual Processes** | Next.js handles :3000, separate ws process handles :8080 | - No different from current architecture<br>- Adds Next.js overhead without benefits |

#### 2. Current Architecture Already Works

The current setup effectively achieves the "single binary" goal:

```bash
# Build process
apps/web (Vite) → build → copy to apps/server/dist/web/
apps/server → build → single binary @caribbean/server

# Runtime
caribbean-server start  # spawns one process with both :3000 and :8080
```

The web dashboard is built into the server and served as static files by Fastify. One command, one process, two ports.

#### 3. Next.js Features Are Not Needed

Caribbean's web dashboard is a **single-page monitoring dashboard**:

| Feature | Caribbean Needs | Next.js Provides |
|---------|----------------|------------------|
| Server-side Rendering | ❌ No SEO requirements | ✅ Yes |
| File-based Routing | ❌ Single page app | ✅ Yes |
| API Routes | ✅ Already handled by Fastify | ✅ Yes |
| Static Generation | ❌ Real-time data only | ✅ Yes |
| Image Optimization | ❌ No images | ✅ Yes |
| Font Optimization | ❌ System fonts only | ✅ Yes |

Using Next.js would add significant complexity for features that won't be used.

#### 4. Migration Cost

| Component | Current Tech | Next.js Migration Effort |
|-----------|--------------|--------------------------|
| REST API | Fastify | Rewrite as API Routes |
| WebSocket | ws | Still needs custom server |
| Frontend | Vite + React | Convert to Next.js components |
| Build Process | Simple scripts | Next.js build pipeline |
| Deployment | Single binary | Custom server or dual process |

**Result**: High effort, no functional gain.

#### 5. Performance Considerations

- **Fastify vs Next.js API Routes**: Fastify is significantly faster than the Next.js API routes handler. For a high-frequency monitoring system, this matters.
- **Vite vs Next.js Dev Server**: Vite's native ES module build is faster than Next.js webpack/turbopack-based approach.
- **Overhead**: Next.js adds ~10-15MB to the node_modules size and startup time.

#### 6. Deployment Flexibility

Current setup:
- ✅ Single binary deployment
- ✅ Works on any Node.js runtime (18+, Bun, etc.)
- ✅ No platform lock-in
- ✅ Easy to containerize (Docker, K8s)
- ✅ Works with systemd, supervisor, PM2, etc.

Next.js with custom server:
- ❌ Not recommended for production by Vercel
- ❌ Can't deploy to Vercel easily
- ❌ Platform-specific optimizations lost

### When Would Next.js Make Sense?

Consider Next.js if Caribbean needs any of these:

1. **Multi-page Dashboard**: Admin panel, user settings, documentation pages
2. **Public-facing Pages**: Marketing site, documentation, public API docs
3. **SEO Requirements**: Search engine indexing needed
4. **ISR/SSR**: Incremental Static Regeneration or Server-side Rendering for performance
5. **Edge Deployment**: Deploying to Edge Functions for global low latency

In that case, a hybrid approach makes more sense:

```
web/           → Next.js (multi-page app)
  - Pages: /dashboard, /docs, /settings
  - API Routes: /api/* (optional)

server/        → Fastify + ws (keep current)
  - WebSocket: :8080
  - REST API: :3000 (optional, keep if Next.js API Routes insufficient)
```

This keeps the WebSocket/agent management separate and only migrates the web layer when it genuinely benefits from Next.js.

## Summary

| Aspect | Current Stack | Next.js |
|--------|--------------|---------|
| Single Process | ✅ Yes | ❌ No (needs custom server) |
| WebSocket Support | ✅ Native (ws) | ❌ No (needs custom setup) |
| Simplicity | ✅ Minimal | ❌ Complex |
| Performance | ✅ Fast (Fastify) | ⚠️ Slower API routes |
| Build Speed | ✅ Fast (Vite) | ⚠️ Slower (webpack/turbopack) |
| Bundle Size | ✅ Smaller | ❌ Larger |
| Deployment | ✅ Flexible | ⚠️ Custom server restrictions |
| Migration Cost | - | ❌ High |

**Conclusion**: The current stack (Fastify + ws + Vite + React) is the right choice for Caribbean's use case. It's simple, fast, and fits the single-process, dual-port architecture perfectly.

Next.js is a great framework, but it solves different problems than what Caribbean faces. The "don't fix what isn't broken" principle applies here.

## Future Considerations

If the web dashboard grows beyond a single-page monitoring view, consider:

1. **Separate web as Next.js app**: Keep server unchanged, only migrate web
2. **Add authentication UI**: Could justify a multi-page app
3. **Public documentation site**: Next.js shines here
4. **Team collaboration features**: Multi-user dashboards, permissions, etc.

Until then, the current architecture remains optimal.
