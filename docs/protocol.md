# Communication Protocol

## Overview

Caribbean uses a custom JSON-based protocol over WebSocket for bidirectional real-time communication between Agents and the Server. All messages are JSON-encoded.

## Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `heartbeat` | Agent → Server | Periodic status report |
| `command` | Server → Agent | Remote command execution |
| `result` | Agent → Server | Command execution result with data |
| `connect` | Agent → Server | Agent connection registration |
| `connected` | Server → Agent | Connection acknowledgment |
| `disconnect` | Agent → Server | Agent disconnection |
| `ack` | Bidirectional | Command acknowledgment (deprecated, use `result`) |

## Message Format

Every message contains a `type` field that identifies the message kind, along with a `payload` or action-specific fields.

---

## Agent → Server

### Heartbeat (Status Report)

Agents periodically send heartbeat messages containing the full node status, including system metrics and OpenClaw Gateway status.

```json
{
  "type": "heartbeat",
  "payload": {
    "nodeId": "node-01",
    "timestamp": "2026-03-17T22:37:00Z",
    "status": {
      "version": "0.1.0",
      "uptime": 86400,
      "memory": {
        "used": 1.2,
        "total": 4.0,
        "percent": 30
      },
      "cpu": {
        "percent": 15
      },
      "agents": {
        "active": 3,
        "max": 10,
        "list": ["reef", "navigator", "shell"]
      },
      "skills": ["shell", "github", "tmux", "browser"],
      "openclawGateway": {
        "status": "running",
        "version": "2026.3.2",
        "pid": 1398337,
        "port": 8000,
        "healthy": false,
        "doctorWarnings": [
          {
            "type": "telegram_group_policy",
            "message": "channels.telegram.groupPolicy is \"allowlist\" but groupAllowFrom is empty",
            "suggestion": "Add sender IDs to groupAllowFrom or set groupPolicy to \"open\"",
            "severity": "warning"
          }
        ],
        "troubles": [
          {
            "type": "auth_missing",
            "message": "No authentication configured (apiKey or jwt)",
            "severity": "warning"
          }
        ]
      }
    }
  }
}
```

### Status Fields Reference

| Field | Type | Description |
|-------|------|-------------|
| `status.version` | string | Agent version |
| `status.uptime` | number | Uptime in seconds |
| `status.memory.used` | number | Used memory in GB |
| `status.memory.total` | number | Total memory in GB |
| `status.memory.percent` | number | Memory usage percentage |
| `status.cpu.percent` | number | CPU usage percentage |
| `status.agents.active` | number | Number of active OpenClaw agents |
| `status.agents.max` | number | Maximum allowed agents |
| `status.agents.list` | string[] | List of active agent names |
| `status.skills` | string[] | Available skills |
| `status.openclawGateway` | object | OpenClaw Gateway status (see below) |

### OpenClaw Gateway Status Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | `"running"`, `"stopped"`, or `"error"` |
| `version` | string | OpenClaw Gateway version |
| `pid` | number | Process ID |
| `port` | number | Listening port |
| `healthy` | boolean | Overall health assessment |
| `doctorWarnings` | array | Configuration warnings |
| `troubles` | array | Configuration problems |
| `healthCheck` | object | Gateway health check result (see below) |

### Health Check Fields

| Field | Type | Description |
|-------|------|-------------|
| `healthCheck.ok` | boolean | Whether the gateway health check passed (`"ok": true` from `openclaw gateway call health`) |
| `healthCheck.ts` | number | Timestamp of the health check response |
| `healthCheck.durationMs` | number | Response duration in milliseconds |
| `healthCheck.error` | string | Error message if health check failed |

---

## Server → Agent (Remote Commands)

The server can send remote commands to connected agents.

```json
{
  "type": "command",
  "id": "cmd-uuid-v4",
  "timestamp": "2026-03-17T22:37:00Z",
  "action": "restart_agent",
  "params": {
    "agentId": "reef",
    "force": false
  }
}
```

### Supported Commands

| Command | Parameters | Description |
|---------|-----------|-------------|
| `restart_agent` | `{ agentId, force }` | Restart a specific OpenClaw agent |
| `update_config` | Configuration object | Update node configuration |
| `openclaw_gateway_start` | — | Start OpenClaw Gateway on the agent node |
| `openclaw_gateway_stop` | — | Stop OpenClaw Gateway on the agent node |
| `read_config` | — | Read OpenClaw configuration file from agent |
| `read_logs` | — | Read last 20 lines of OpenClaw logs |
| `gateway_health_check` | — | Run `openclaw gateway call health` and return result |
| `fix_openclaw_config` | `{ backup, dryRun }` | Fix OpenClaw configuration issues |
| `get_openclaw_status` | — | Get detailed OpenClaw Gateway status |
| `validate_openclaw` | — | Validate OpenClaw configuration file |

### Gateway Command Flow

When a gateway start/stop command is received:

1. Agent executes `openclaw gateway start` or `openclaw gateway stop` via `execSync` (30s timeout)
2. Agent sends back a `result` message with success/failure status
3. Agent triggers an immediate heartbeat to report updated Gateway status to the server
4. Web dashboard reflects the status change on next data refresh

### Command Result

After processing a command, the agent sends back a result message containing the execution status and any returned data:

```json
{
  "type": "result",
  "timestamp": "2026-03-17T22:37:00Z",
  "id": "cmd-uuid-v4",
  "success": true,
  "data": {
    "config": {
      "gateway": {
        "port": 8000
      },
      "channels": {
        "telegram": {
          "token": "xxx",
          "groupPolicy": "open"
        }
      },
      "skills": ["shell", "github", "tmux", "browser"]
    }
  }
}
```

**Example for `read_logs` command:**

```json
{
  "type": "result",
  "timestamp": "2026-03-17T22:37:00Z",
  "id": "cmd-uuid-v4",
  "success": true,
  "data": {
    "logs": "[2026-03-17 22:37:00] INFO: Gateway started\n[2026-03-17 22:37:01] INFO: Listening on port 8000..."
  }
}
```

**Error Response:**

```json
{
  "type": "result",
  "timestamp": "2026-03-17T22:37:00Z",
  "id": "cmd-uuid-v4",
  "success": false,
  "error": "Config file not found"
}
```

**Result Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Always `"result"` |
| `timestamp` | string | ISO 8601 timestamp |
| `id` | string | Command ID matching the original command |
| `success` | boolean | Whether command executed successfully |
| `error` | string? | Error message if success is false |
| `data` | object? | Command-specific result data |

---

## WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `connect` | Agent → Server | Agent connection registration |
| `heartbeat` | Agent → Server | Periodic heartbeat / status report |
| `disconnect` | Agent → Server | Agent disconnection |
| `command` | Server → Agent | Remote command dispatch |
| `result` | Agent → Server | Command execution result with data |
| `ack` | Bidirectional | Command acknowledgment (deprecated) |
| `connected` | Server → Agent | Connection acknowledgment with assigned node ID |
| `dashboard:broadcast` | Server → Dashboard | Broadcast state changes to dashboards |

---

## Connection Flow

1. **Agent connects** to `ws://server:8080/ws/agent`
2. **Agent sends** `connect` message with node information (ID, name, tags, IP)
3. **Server responds** with `connected` message and assigned node ID
4. **Agent sends** immediate heartbeat (triggers first OpenClaw Gateway status check)
5. **Periodic heartbeats** every 30 seconds (configurable)
6. **Server syncs** node status to database after each heartbeat

### Node State Preservation

- **First connection**: Server creates new node record with provided name, tags, and IP
- **Reconnection**: Server loads existing `name`, `tags`, and `clientIp` from database, only updates `connected` status and `last_seen`
- **Disconnection**: Server sets `connected = false`, `openclaw_status = "unknown"`, records `last_seen` timestamp
