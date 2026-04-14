# OpenClaw Monitoring and Auto-Fix

## Overview

Caribbean Agent provides comprehensive OpenClaw Gateway monitoring, intelligent diagnostics, and automatic configuration repair. The agent-side approach ensures accurate, low-latency status checks by directly accessing the local Gateway.

---

## Status Monitoring

### What Is Monitored

The agent periodically collects the following Gateway status information:

| Metric | Description |
|--------|-------------|
| **Running status** | `running`, `stopped`, or `error` |
| **Process info** | PID, port, version |
| **Health check** | Overall health assessment via `openclaw gateway call health` |
| **Doctor Warnings** | Configuration warnings and suggestions |
| **Troubles** | Configuration problems and errors |

### How It Works

The agent verifies Gateway status every heartbeat (default: 30 seconds) by checking the local HTTP endpoint:

```bash
curl -s -o /dev/null -w "%{http_code}" \
  --connect-timeout 3 \
  --max-time 5 \
  "http://localhost:8000/api/gateway/status"
```

- **Timeouts**: 3s connect, 5s total
- **Status**: Returns `"running"` or `"stopped"`
- **Reporting**: Included in every heartbeat message to the server

### Gateway Health Check

When the Gateway is running, the agent also performs a real health check via `openclaw gateway call health`:

```bash
openclaw gateway call health
```

- **Timeout**: 10 seconds
- **Success**: Parses JSON response and checks `"ok": true`
- **Failure**: Records error message and marks the node as unhealthy
- **Integration**: Results are included in the `healthCheck` field of `openclawGateway` status

**Healthy response:**

```json
{
  "ok": true,
  "ts": 1776180771768,
  "durationMs": 0
}
```

**Unhealthy response:**

```json
{
  "ok": false,
  "error": "gateway closed (1006 abnormal closure)"
}
```

If the health check fails (`ok !== true`), the overall `healthy` field is set to `false` regardless of other diagnostics.

### Advantages of Agent-Side Verification

| Aspect | Agent-Side | Server-Side |
|--------|-----------|-------------|
| **Accuracy** | Direct local access | Remote checks may fail |
| **Latency** | Instant detection | Network delays |
| **Complexity** | Simple and reliable | Hardcoded URLs |
| **Scalability** | Self-contained | Server bottleneck |

---

## Intelligent Diagnostics

The agent automatically detects the following issues:

### Doctor Warnings

| Warning Type | Description |
|-------------|-------------|
| `telegram_group_policy` | Telegram group policy is set to `allowlist` but the allowlist is empty |
| Missing skills | Required skills are not configured |
| Missing agents | Required agents are not configured |

### Troubles

| Trouble Type | Description |
|-------------|-------------|
| `auth_missing` | No authentication configured (apiKey or jwt) |
| `port_missing` | Gateway port configuration is missing |
| `pid_missing` | PID file is missing or stale |
| `config_parse_error` | Configuration file cannot be parsed |

### Example Diagnostics Output

```json
{
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
    ],
    "healthCheck": {
      "ok": true,
      "ts": 1776180771768,
      "durationMs": 0
    }
  }
}
```

---

## Auto-Fix

Use the `fix-openclaw` command to automatically repair common configuration issues.

### Usage

```bash
# Check current status
caribbean-agent openclaw-status

# Auto-fix with backup
caribbean-agent fix-openclaw --backup

# Preview fixes without making changes
caribbean-agent fix-openclaw --dry-run
```

### Supported Auto-Fixes

| Issue Type | Fix Applied |
|-----------|-------------|
| Telegram group policy is `allowlist` with empty list | Set policy to `open` |
| Missing `skills` configuration | Add default skills: `shell`, `github`, `tmux`, `browser` |
| Missing `agents` configuration | Add default agents: `reef`, `navigator`, `shell` |
| Missing Gateway port | Set default port `8000` |
| Missing authentication | Auto-generate API Key |

---

## Web Dashboard Display

The dashboard displays real-time OpenClaw status for each node:

### Health Indicators

| Status | Color | Description |
|--------|-------|-------------|
| Healthy | Green | No warnings or errors |
| Warning | Yellow | Doctor warnings present |
| Error | Red | Errors detected |

### Issue Severity Icons

| Icon | Severity |
|------|----------|
| ⚠️ | Warning |
| ❌ | Error |
| ℹ️ | Info |

The dashboard shows the total count of active warnings and errors for each node, along with severity icons to help quickly identify issues.

### Remote Gateway Management

The dashboard supports remote Gateway lifecycle management. Users can select instances via checkboxes and use the "Execute Action" dropdown to start or stop the OpenClaw Gateway remotely.

**Button availability rules:**

| Condition | Start | Stop |
|-----------|-------|------|
| No instances selected | Disabled | Disabled |
| All selected instances are `running` | Disabled | Enabled |
| All selected instances are `stopped` | Enabled | Disabled |
| Mixed statuses or contains `unknown`/`error` | Disabled | Disabled |

**Execution flow:**

1. User selects instances and clicks Start/Stop
2. Dashboard sends `POST /api/nodes/:id/command` for each selected instance
3. Server forwards the command to the agent via WebSocket
4. Agent executes `openclaw gateway start/stop` locally via `execSync`
5. Agent sends result message and triggers an immediate heartbeat with updated status
6. Dashboard refreshes data and displays the updated Gateway status

---

## View Modes

The dashboard supports two view modes for displaying node instances:

### List View

- Traditional table layout showing all node information in rows
- Suitable for viewing many instances at once
- Displays: Status, Name, ID, IP, Gateway Status, Last Seen, CPU, Memory, Uptime

### Card View

- Grid layout with each node in a card
- Shows the same information as list view but in a more visual format
- Additional features:
  - **Configuration** button (配置) - Read and display `~/.openclaw/openclaw.json` in JSON format
  - **Logs** button (日志) - Fetch and display last 20 lines of OpenClaw logs
  - Both buttons are disabled for offline nodes

**View Switching:**

Click the list/grid icons in the top-right corner of the nodes section to toggle between views.

---

## Configuration and Logs Viewing

### Configuration Viewing

The dashboard can retrieve and display the OpenClaw configuration file from any online node:

**Process:**

1. User clicks "Configuration" button on a node card
2. Dashboard sends `read_config` command via WebSocket
3. Agent reads `~/.openclaw/openclaw.json` from the node
4. Agent returns configuration in `result` message
5. Dashboard polls `GET /api/commands/:id/result` endpoint to retrieve the config
6. Configuration is displayed in a modal dialog with JSON syntax highlighting

**Configuration Display:**

- Full JSON content of `openclaw.json`
- Read-only view
- Can be scrolled for large configurations
- Includes loading and error states

### Logs Viewing

The dashboard can retrieve and display recent OpenClaw logs from any online node:

**Process:**

1. User clicks "Logs" button on a node card
2. Dashboard sends `read_logs` command via WebSocket
3. Agent executes `openclaw logs | tail -n 20` on the node
4. Agent returns last 20 log lines in `result` message
5. Dashboard polls `GET /api/commands/:id/result` endpoint to retrieve the logs
6. Logs are displayed in a modal dialog with monospace font

### On-Demand Health Check

The dashboard can trigger an on-demand Gateway health check on any online node:

**Process:**

1. Dashboard sends `gateway_health_check` command via WebSocket
2. Agent executes `openclaw gateway call health` on the node
3. Agent parses the JSON response and checks `"ok": true`
4. Agent returns the health data in a `result` message
5. Agent triggers an immediate heartbeat with updated status
6. Dashboard polls `GET /api/commands/:id/result` to retrieve the health data

**Result example:**

```json
{
  "success": true,
  "data": {
    "health": {
      "ok": true,
      "ts": 1776180771768,
      "durationMs": 0,
      "channels": {},
      "defaultAgentId": "main"
    }
  }
}
```

**Log Display Features:**

- Shows last 20 lines of OpenClaw logs
- Monospace font for easy reading
- Auto-wrapping for long lines
- Download button to save logs as `.txt` file
- Includes loading and error states

**Important Notes:**

- Configuration and logs are fetched in real-time from the agent
- No data is stored in the server database
- Results are cleared from server memory after retrieval
- Both features require the node to be online
- Commands time out after 5 seconds if no result is received

---

## Node State Management

### Agent Reconnection

When an agent reconnects to the server:

1. **Node Registration**: Server checks database for existing node ID
   - **Exists**: Loads saved `name`, `tags`, and `clientIp` from database; only updates `connected` and `last_seen`
   - **New node**: Creates record with client-provided information

2. **Immediate Status Check**: Agent sends heartbeat immediately upon connection, triggering instant Gateway status verification

3. **State Preservation**: All existing configuration is retained:
   - `name` — Custom display names are permanently saved
   - `tags` — Node tags survive server restarts
   - Historical status data

### Node Disconnection

When a node disconnects:

1. **Status updates**:
   - `connected` → `false`
   - `openclaw_status` → `"unknown"`
   - `last_seen` → current timestamp

2. **Dashboard display**:
   - Connection status: Shows "Offline"
   - Gateway status: Always shows `unknown` badge
   - CPU/Uptime: Shows `-` (no data available)

3. **Data preservation**: Historical records remain intact

---

## Database Migration System

### Overview

Caribbean includes an automated migration system for managing database schema changes.

### How It Works

1. **Startup Check**: Server checks for pending migrations on startup
2. **Schema Init**: Creates `migrations` table if it doesn't exist
3. **Migration Run**: Executes any unapplied migrations
4. **Version Tracking**: Records executed migrations
5. **Continue**: Server starts normally

### Adding New Migrations

Add migrations in `apps/server/src/database.ts`:

```typescript
private getMigrations(): Migration[] {
  return [
    {
      version: 1,
      name: 'add_client_ip_column',
      up: `ALTER TABLE nodes ADD COLUMN client_ip TEXT;`
    },
    {
      version: 2,
      name: 'add_new_feature',
      up: `ALTER TABLE nodes ADD COLUMN new_column TEXT DEFAULT 'default';`
    }
  ];
}
```

### Migration Rules

- `version` must be unique and incrementing
- `name` should describe the migration purpose
- `up` contains the actual SQL statement
- Supports both SQLite and PostgreSQL
- Each migration runs only once (idempotent)

### Upgrading Existing Databases

When upgrading from an older version, all pending migrations run automatically on first startup. No manual intervention required.

### Verifying Migrations

```bash
# Connect to SQLite
sqlite3 data/caribbean.db

# View migration history
SELECT version, name, executed_at FROM migrations ORDER BY version;

# Check history count per node
SELECT node_id, COUNT(*) as count FROM status_history GROUP BY node_id;
```

---

## Internationalization

The dashboard supports multiple languages with easy switching:

### Supported Languages

| Language | Code | Usage |
|----------|-------|-------|
| English | `en` | Default for English-speaking users |
| Chinese (Simplified) | `zh` | Default language (中文) |

### Language Switching

- Click the language selector button in the top-right header
- Languages are stored in browser localStorage
- Selected language persists across sessions

### Localized Elements

The following UI elements support internationalization:

- **Header and navigation labels**
- **Node list/table headers**
- **Status indicators** (Online/Offline)
- **Button labels**:
  - Configuration / 配置
  - Logs / 日志
  - Start / 启动
  - Stop / 停止
  - Delete / 删除
- **Time units** (minutes ago / 分钟前)
- **Error messages and notifications**

### Card View Labels

In card view mode, the action buttons are localized:

- **Configuration** → **配置** (Chinese)
- **Logs** → **日志** (Chinese)

These buttons are displayed in the user's selected language and are disabled when the node is offline.
```
