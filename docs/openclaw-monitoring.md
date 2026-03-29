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
| **Health check** | Overall health assessment |
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
    ]
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
