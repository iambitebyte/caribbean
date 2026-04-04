# API Documentation

## Overview

Caribbean provides a comprehensive REST API for managing and monitoring OpenClaw clusters. The API follows RESTful conventions and returns JSON responses.

## Base URL

```
http://your-server:3000/api
```

## Authentication

Caribbean supports two authentication methods:

### 1. Agent Token Authentication

If Agent authentication is enabled, include token in WebSocket connection:

```javascript
const ws = new WebSocket('ws://server:8080/ws/agent', {
  headers: {
    'Authorization': 'Bearer your-agent-token'
  }
});
```

### 2. Web UI JWT Authentication

If Web UI authentication is enabled, obtain a JWT token via login endpoint:

```bash
# Login to get JWT token
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'

# Response:
# {
#   "success": true,
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "username": "admin"
# }
```

Include JWT token in subsequent API requests:

```
Authorization: Bearer <your-jwt-token>
```

**Note**: If authentication is not enabled, all endpoints can be accessed without authentication.

## Endpoints

### Login (Web UI Authentication)

Authenticate user and receive JWT token for subsequent API calls.

**Request:**

```http
POST /api/login
Content-Type: application/json
```

**Body:**

```json
{
  "username": "admin",
  "password": "your-password"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwiaWF0IjoxNjk5MjM4NDAwLCJleHAiOjE3MDAwMDI4MDB9.xxx",
  "username": "admin"
}
```

**Error Responses:**

- **400 Bad Request** - Authentication not enabled
  ```json
  {
    "error": "Authentication is not enabled"
  }
  ```

- **400 Bad Request** - Missing credentials
  ```json
  {
    "error": "Username and password are required"
  }
  ```

- **401 Unauthorized** - Invalid credentials
  ```json
  {
    "error": "Invalid username or password"
  }
  ```

**Token Details:**
- **Expiration**: 7 days from issuance
- **Usage**: Include in `Authorization: Bearer <token>` header for all subsequent API calls
- **Storage**: Store in browser localStorage

---

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

**Authentication**: Required (if enabled)

**Request:**

```http
GET /api/nodes
Authorization: Bearer <your-jwt-token>
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

**Authentication**: Required (if enabled)

**Request:**

```http
GET /api/nodes/:id
Authorization: Bearer <your-jwt-token>
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

### Delete Node

Delete a node from the database. This will remove the node record and all associated status history.

**Authentication**: Required (if enabled)

**Request:**

```http
DELETE /api/nodes/:id
Authorization: Bearer <your-jwt-token>
```

**Parameters:**

- `id` (path): Node ID (UUID)

**Response (200 OK):**

```json
{
  "success": true,
  "nodeId": "node-01"
}
```

**Response (500 Internal Server Error):**

```json
{
  "error": "Failed to delete node"
}
```

**Response (501 Not Implemented):**

```json
{
  "error": "Database not available"
}
```

**Important Notes:**
- This operation will permanently delete the node from the database
- All associated status history records will be deleted due to `ON DELETE CASCADE` foreign key constraint
- The node will also be removed from the in-memory node manager
- If the node is currently connected, it will appear as a new node when it reconnects
- This action cannot be undone

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
| `openclaw_gateway_start` | Start OpenClaw Gateway on the node | — |
| `openclaw_gateway_stop` | Stop OpenClaw Gateway on the node | — |
| `read_config` | Read OpenClaw configuration from agent | — |
| `read_logs` | Read last 20 lines of OpenClaw logs | — |

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

### Get Command Result

Retrieve the result of a previously sent command. This endpoint is used to fetch data returned by commands like `read_config` and `read_logs`.

**Request:**

```http
GET /api/commands/:id/result
Authorization: Bearer <your-jwt-token>
```

**Parameters:**

- `id` (path): Command ID returned from the `/nodes/:id/command` endpoint

**Response (200 OK):**

For `read_config` command:

```json
{
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
      "skills": ["shell", "github", "tmux", "browser"],
      "agents": {
        "active": 3,
        "max": 10,
        "list": ["reef", "navigator", "shell"]
      }
    }
  },
  "timestamp": "2026-03-17T22:37:00Z"
}
```

For `read_logs` command:

```json
{
  "success": true,
  "data": {
    "logs": "[2026-03-17 22:37:00] INFO: Gateway started\n[2026-03-17 22:37:01] INFO: Listening on port 8000..."
  },
  "timestamp": "2026-03-17T22:37:00Z"
}
```

**Response (404 Not Found):**

```json
{
  "error": "Command result not found"
}
```

**Important Notes:**

- Command results are temporarily stored in memory and are cleared after retrieval
- If the command result is not yet available, retry after a short delay (recommended: 500ms)
- The client should poll this endpoint with a timeout (recommended: 5 seconds)
- Results are automatically deleted after being retrieved

**Example Usage:**

```javascript
// 1. Send command to read config
const commandResponse = await fetch('/api/nodes/node-01/command', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'read_config' })
});
const { commandId } = await commandResponse.json();

// 2. Poll for result
const maxRetries = 10;
const retryDelay = 500;

for (let i = 0; i < maxRetries; i++) {
  await new Promise(resolve => setTimeout(resolve, retryDelay));

  try {
    const resultResponse = await fetch(`/api/commands/${commandId}/result`);
    if (resultResponse.status === 404) {
      continue; // Result not ready yet
    }

    const result = await resultResponse.json();
    if (result.success) {
      console.log('Config:', result.data.config);
      break;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    if (i === maxRetries - 1) {
      throw error;
    }
  }
}
```

---

### Get Authentication Status

Check if Web UI authentication is enabled.

**Authentication**: Not required

**Request:**

```http
GET /api/auth/status
```

**Response (200 OK):**

```json
{
  "enabled": true
}
```

---

### Get Settings

Retrieve current authentication and agent settings.

**Authentication**: Required (if Web UI auth is enabled)

**Request:**

```http
GET /api/settings
Authorization: Bearer <your-jwt-token>
```

**Response (200 OK):**

```json
{
  "auth": {
    "enabled": true,
    "username": "admin",
    "agentTokenSet": true
  }
}
```

---

### Update Authentication Settings

Update authentication configuration. Changes take effect immediately without server restart.

**Authentication**: Required (if Web UI auth is enabled)

**Request:**

```http
POST /api/settings/auth
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

**Body:**

```json
{
  "enabled": true,
  "username": "admin",
  "password": "new-password",
  "agentToken": "optional-agent-token"
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `enabled` | boolean | No | Enable or disable Web UI authentication |
| `username` | string | When `enabled=true` | Username for Web UI login |
| `password` | string | When `enabled=true` | Password for Web UI login |
| `agentToken` | string | No | Agent authentication token (empty string to disable) |

**Response (200 OK):**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Note:** When authentication is enabled or credentials are changed, a new JWT token is returned. The frontend automatically stores this token for continued access.

**Error Responses:**

- **400 Bad Request**: Missing required fields
  ```json
  {
    "error": "Username and password are required to enable auth"
  }
  ```

- **401 Unauthorized**: Not logged in (if auth is enabled)

- **500 Internal Server Error**: Failed to update settings
  ```json
  {
    "error": "Failed to update settings"
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

# Delete a node
curl -X DELETE http://localhost:3000/api/nodes/node-01

# Send start gateway command
curl -X POST http://localhost:3000/api/nodes/node-01/command \
  -H "Content-Type: application/json" \
  -d '{"action": "openclaw_gateway_start"}'

# Send stop gateway command
curl -X POST http://localhost:3000/api/nodes/node-01/command \
  -H "Content-Type: application/json" \
  -d '{"action": "openclaw_gateway_stop"}'

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

// Delete a node
const deleteCmd = await fetch('http://localhost:3000/api/nodes/node-01', {
  method: 'DELETE'
});
const deleteResult = await deleteCmd.json();
console.log(deleteResult);

// Send command to start OpenClaw Gateway
const startCmd = await fetch('http://localhost:3000/api/nodes/node-01/command', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'openclaw_gateway_start',
    params: {}
  })
});
const startResult = await startCmd.json();
console.log(startResult);

// Send command to stop OpenClaw Gateway
const stopCmd = await fetch('http://localhost:3000/api/nodes/node-01/command', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'openclaw_gateway_stop',
    params: {}
  })
});
const stopResult = await stopCmd.json();
console.log(stopResult);
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

# Delete a node
delete_cmd = requests.delete('http://localhost:3000/api/nodes/node-01')
delete_result = delete_cmd.json()
print(delete_result)

# Send command to start OpenClaw Gateway
start_cmd = requests.post(
    'http://localhost:3000/api/nodes/node-01/command',
    json={
        'action': 'openclaw_gateway_start',
        'params': {}
    }
)
start_result = start_cmd.json()
print(start_result)

# Send command to stop OpenClaw Gateway
stop_cmd = requests.post(
    'http://localhost:3000/api/nodes/node-01/command',
    json={
        'action': 'openclaw_gateway_stop',
        'params': {}
    }
)
stop_result = stop_cmd.json()
print(stop_result)
```
