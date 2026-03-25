# API Documentation

## Overview

Caribbean provides a comprehensive REST API for managing and monitoring OpenClaw clusters. The API follows RESTful conventions and returns JSON responses.

## Base URL

```
http://your-server:3000/api
```

## Authentication

If authentication is enabled, include the token in the `Authorization` header:

```
Authorization: Bearer <your-token>
```

## Endpoints

### Health Check

Check if the API server is running.

**Request:**

```http
GET /api/health
```

**Response (200 OK):**

```json
{
  "status": "ok",
  "timestamp": "2026-03-17T22:37:00Z"
}
```

---

### Get All Nodes

Retrieve a list of all registered nodes.

**Request:**

```http
GET /api/nodes
```

**Response (200 OK):**

```json
{
  "nodes": [
    {
      "id": "node-01",
      "name": "production-01",
      "tags": ["prod", "gpu"],
      "connected": true,
      "lastSeen": "2026-03-17T22:37:00Z",
      "clientIp": "192.168.1.100",
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
        "openclawGateway": "running"
      },
      "openclawStatus": "running"
    }
  ],
  "count": 1
}
```

---

### Get Node Details

Retrieve detailed information about a specific node.

**Request:**

```http
GET /api/nodes/:id
```

**Parameters:**

- `id` (path): Node ID

**Response (200 OK):**

```json
{
  "id": "node-01",
  "name": "production-01",
  "tags": ["prod", "gpu"],
  "connected": true,
  "lastSeen": "2026-03-17T22:37:00Z",
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
      "openclawGateway": "running"
    }
  }
}
```

**Response (404 Not Found):**

```json
{
  "error": "Node not found"
}
```

---

### Get Node Status

Get the current status of a specific node.

**Request:**

```http
GET /api/nodes/:id/status
```

**Parameters:**

- `id` (path): Node ID

**Response (200 OK):**

```json
{
  "nodeId": "node-01",
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
      "openclawGateway": "running"
    },
  "lastSeen": "2026-03-17T22:37:00Z",
  "connected": true
}
```

---

### Update Node Name

Update the display name of a node.

**Request:**

```http
PATCH /api/nodes/:id/name
```

**Parameters:**

- `id` (path): Node ID

**Body:**

```json
{
  "name": "new-name"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "nodeId": "node-01",
  "name": "new-name"
}
```

**Response (400 Bad Request):**

```json
{
  "error": "Name is required"
}
```

**Response (404 Not Found):**

```json
{
  "error": "Node not found"
}
```

**Response (501 Not Implemented):**

```json
{
  "error": "Database not available"
}
```

---

### Send Command to Node

Send a remote command to a specific node.

**Request:**

```http
POST /api/nodes/:id/command
```

**Parameters:**

- `id` (path): Node ID

**Body:**

```json
{
  "action": "restart_agent",
  "params": {
    "agentId": "reef",
    "force": false
  }
}
```

**Available Actions:**

| Action | Description | Params |
|--------|-------------|--------|
| `restart_agent` | Restart a specific agent | `agentId`, `force` |
| `update_config` | Update node configuration | Configuration object |
| `execute_task` | Execute a task on the node | Task details |

**Response (200 OK):**

```json
{
  "success": true,
  "commandId": "cmd-uuid-v4",
  "nodeId": "node-01",
  "action": "restart_agent"
}
```

**Response (400 Bad Request):**

```json
{
  "success": false,
  "error": "Node not connected"
}
```

---

### Get Cluster Statistics

Retrieve overall cluster statistics.

**Request:**

```http
GET /api/stats
```

**Response (200 OK):**

```json
{
  "total": 3,
  "connected": 2,
  "disconnected": 1,
  "totalMemory": 12.0,
  "usedMemory": 3.6,
  "totalAgents": 6
}
```

---

## WebSocket API

### Connection

Connect to the WebSocket server:

```
ws://your-server:8080/ws/agent
```

### Connection Flow

1. **Agent Connects**: Sends `connect` message with node information
2. **Server Responds**: Sends `connected` message with assigned node ID
3. **Immediate Heartbeat**: Agent sends immediate heartbeat with OpenClaw status check
4. **Periodic Heartbeats**: Agent sends heartbeat every 30 seconds (configurable)
5. **Server Updates**: Syncs node status to database after each heartbeat

### Node State Preservation

- **First Connection**: Server creates new node record with provided name, tags
- **Reconnection**: Server updates only `connected` status and `last_seen`, preserves existing name and tags
- **Disconnection**: Server sets `connected = false` and `openclaw_status = 'unknown'`

### Events

#### Agent -> Server

**Connect**

```json
{
  "type": "connect",
  "timestamp": "2026-03-17T22:37:00Z",
  "payload": {
    "nodeId": "node-01",
    "name": "production-01",
    "tags": ["prod", "gpu"],
    "version": "0.1.0"
  }
}
```

**Heartbeat**

```json
{
  "type": "heartbeat",
  "timestamp": "2026-03-17T22:37:00Z",
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
    "openclawGateway": "running"
  },
  "openclawStatus": "running"
  }
}
```

#### Server -> Agent

**Command**

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

**Ack**

```json
{
  "type": "ack",
  "timestamp": "2026-03-17T22:37:00Z",
  "id": "cmd-uuid-v4",
  "success": true
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request |
| 404 | Not Found |
| 500 | Internal Server Error |

## Rate Limiting

Currently, there is no rate limiting implemented. Consider adding rate limiting for production use.

## WebSocket Events Reference

| Event | Direction | Description |
|-------|-----------|-------------|
| `connect` | Agent → Server | Agent connects and registers |
| `heartbeat` | Agent → Server | Periodic status update |
| `disconnect` | Agent → Server | Agent disconnects |
| `command` | Server → Agent | Remote command execution |
| `ack` | Bidirectional | Command acknowledgment |
| `dashboard:broadcast` | Server → Dashboard | Real-time updates to dashboard |

## Examples

### Using cURL

```bash
# Get all nodes
curl http://localhost:3000/api/nodes

# Get specific node
curl http://localhost:3000/api/nodes/node-01

# Update node name
curl -X PATCH http://localhost:3000/api/nodes/node-01/name \
  -H "Content-Type: application/json" \
  -d '{"name": "new-name"}'

# Send command
curl -X POST http://localhost:3000/api/nodes/node-01/command \
  -H "Content-Type: application/json" \
  -d '{"action": "restart_agent", "params": {"agentId": "reef"}}'
```

### Using JavaScript (Fetch API)

```javascript
// Get all nodes
const response = await fetch('http://localhost:3000/api/nodes');
const data = await response.json();
console.log(data.nodes);

// Update node name
const nameUpdate = await fetch('http://localhost:3000/api/nodes/node-01/name', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'new-name' })
});
const nameResult = await nameUpdate.json();
console.log(nameResult);

// Send command
const command = await fetch('http://localhost:3000/api/nodes/node-01/command', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'restart_agent',
    params: { agentId: 'reef' }
  })
});
const result = await command.json();
console.log(result);
```

### Using Python (requests)

```python
import requests

# Get all nodes
response = requests.get('http://localhost:3000/api/nodes')
data = response.json()
print(data['nodes'])

# Update node name
name_update = requests.patch(
    'http://localhost:3000/api/nodes/node-01/name',
    json={'name': 'new-name'}
)
result = name_update.json()
print(result)

# Send command
command = requests.post(
    'http://localhost:3000/api/nodes/node-01/command',
    json={
        'action': 'restart_agent',
        'params': {'agentId': 'reef'}
    }
)
result = command.json()
print(result)
```
