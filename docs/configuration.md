# Configuration Reference

## Overview

Caribbean uses JSON configuration files stored in `~/.caribbean/`. Configuration is typically managed via CLI commands, but can also be edited directly.

---

## Agent Configuration

**Location**: `~/.caribbean/agent.json`

```json
{
  "server": {
    "url": "ws://localhost:8080",
    "reconnectInterval": 5000,
    "heartbeatInterval": 30000
  },
  "node": {
    "id": "auto",
    "name": "production-01",
    "tags": ["prod", "gpu"]
  },
  "openclaw": {
    "configPath": "~/.openclaw/config.yaml",
    "apiPort": 8080
  },
  "auth": {
    "token": "your-secret-token"
  }
}
```

### Field Reference

#### `server`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `url` | string | — | WebSocket server URL |
| `reconnectInterval` | number | `5000` | Reconnection interval in milliseconds |
| `heartbeatInterval` | number | `30000` | Heartbeat interval in milliseconds |

#### `node`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | string | `"auto"` | Node ID (`"auto"` for UUID generation, or custom ID) |
| `name` | string | — | Display name for this node |
| `tags` | string[] | `[]` | Tags for categorizing the node |

#### `openclaw`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `configPath` | string | `"~/.openclaw/config.yaml"` | Path to OpenClaw configuration file |
| `apiPort` | number | `8080` | OpenClaw API port |

#### `auth`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `token` | string | — | Token for server authentication |

### CLI Setup

```bash
# Initialize agent with server URL
caribbean-agent init --server ws://your-server:8080

# Initialize with authentication token
caribbean-agent init --server ws://your-server:8080 --token your-secret-token
```

---

## Server Configuration

**Location**: `~/.caribbean/server.json`

```json
{
  "websocket": {
    "port": 8080,
    "path": "/ws/agent",
    "maxConnections": 1000
  },
  "api": {
    "port": 3000,
    "host": "0.0.0.0",
    "webDistPath": "./dist/web"
  },
  "database": {
    "type": "sqlite",
    "path": "./data/caribbean.db"
  },
  "history": {
    "retention": 5,
    "cleanup": "auto"
  },
  "auth": {
    "enabled": true,
    "tokens": ["your-secret-token"],
    "user": {
      "username": "admin",
      "password": "your-secure-password"
    },
    "jwtSecret": "caribbean-jwt-secret-xxx"
  }
}
```

### Field Reference

#### `websocket`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `port` | number | `8080` | WebSocket server port |
| `path` | string | `"/ws/agent"` | WebSocket endpoint path |
| `maxConnections` | number | `1000` | Maximum concurrent agent connections |

#### `api`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `port` | number | `3000` | REST API and Web UI port |
| `host` | string | `"0.0.0.0"` | Listen address |
| `webDistPath` | string | `"./dist/web"` | Path to built Web UI assets |

#### `database`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | `"sqlite"` | Database type (`"sqlite"` or `"postgresql"`) |
| `path` | string | `"./data/caribbean.db"` | Database file path (SQLite) or connection string (PostgreSQL) |

#### `history`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `retention` | number | `5` | Number of status records to keep per node |
| `cleanup` | string | `"auto"` | Cleanup mode (`"auto"` for automatic) |

#### `auth`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable authentication |
| `tokens` | string[] | `[]` | Valid tokens for agent connections |
| `user.username` | string | — | Web UI login username |
| `user.password` | string | — | Web UI login password |
| `jwtSecret` | string | auto-generated | Secret key for JWT token signing |

### CLI Setup

```bash
# Initialize server
caribbean-server init

# Initialize with authentication token
caribbean-server init --token your-secret-token

# Enable Web UI authentication
caribbean-server set-auth --username admin --password your-secure-password

# Disable Web UI authentication
caribbean-server set-auth --disable
```

### Web UI Settings (Recommended)

You can also manage authentication settings directly from the Web UI:

1. Access the dashboard at `http://localhost:3000`
2. Click the **Settings** (gear icon) button
3. Configure authentication settings
4. Changes take effect immediately without server restart

**Benefits of Web UI Settings:**
- No server restart required
- Automatic token renewal when credentials change
- User-friendly interface
- Real-time validation
- Hot reload of authentication configuration

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CARIBBEAN_AUTH_TOKEN` | Agent authentication token | — |
| `CARIBBEAN_SERVER_URL` | Server WebSocket URL (agent) | `ws://localhost:8080` |
| `CARIBBEAN_NODE_NAME` | Node display name (agent) | auto-generated |
| `CARIBBEAN_WEB_USERNAME` | Web UI username | — |
| `CARIBBEAN_WEB_PASSWORD` | Web UI password | — |
| `CARIBBEAN_JWT_SECRET` | JWT signing secret | auto-generated |
| `CARIBBEAN_LOG_LEVEL` | Log level | `info` |
| `NODE_ENV` | Environment mode | `development` |

---

## PID Files

Caribbean uses PID files to track running services:

| Service | PID File |
|---------|----------|
| Server | `~/.caribbean/server.pid` |
| Agent | `~/.caribbean/agent.pid` |

### Stop Mechanism

1. Send `SIGTERM` signal (graceful shutdown, 10-second timeout)
2. If timeout, send `SIGKILL` signal (forced shutdown)
3. Remove PID file

### Duplicate Start Prevention

- Checks PID file before starting
- Rejects start if service is already running
- Cleans up stale PID files automatically
