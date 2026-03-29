# Service Management

## Overview

Caribbean provides CLI tools for managing both the Server and Agent services, including start, stop, restart, and status monitoring.

---

## Server Commands

```bash
# Start server
npx tsx apps/server/src/cli.js start

# Stop server (stops WebSocket :8080 and REST API :3000)
npx tsx apps/server/src/cli.js stop

# Restart server
npx tsx apps/server/src/cli.js restart

# View server configuration status
npx tsx apps/server/src/cli.js status

# View help
npx tsx apps/server/src/cli.js --help
```

---

## Agent Commands

```bash
# Start agent
npx tsx apps/agent/src/cli.js start

# Stop agent
npx tsx apps/agent/src/cli.js stop

# Restart agent
npx tsx apps/agent/src/cli.js restart

# View agent configuration status
npx tsx apps/agent/src/cli.js status

# View help
npx tsx apps/agent/src/cli.js --help
```

---

## OpenClaw Management Commands

```bash
# Check OpenClaw Gateway detailed status
npx tsx apps/agent/src/cli.js openclaw-status

# Validate OpenClaw configuration file
npx tsx apps/agent/src/cli.js validate-openclaw

# Auto-fix OpenClaw configuration issues
npx tsx apps/agent/src/cli.js fix-openclaw

# Preview fixes without making changes
npx tsx apps/agent/src/cli.js fix-openclaw --dry-run

# Fix with backup
npx tsx apps/agent/src/cli.js fix-openclaw --backup
```

### Supported Auto-Fixes

| Issue | Fix |
|-------|-----|
| Telegram group policy is `allowlist` but list is empty | Set policy to `open` |
| Missing `skills` configuration | Add default skills (shell, github, tmux, browser) |
| Missing `agents` list | Add default agents (reef, navigator, shell) |
| Missing Gateway port | Set default port 8000 |
| Missing authentication | Auto-generate API Key |

---

## Authentication Management

```bash
# Enable Web UI authentication
caribbean-server set-auth --username admin --password your-secure-password

# Disable Web UI authentication
caribbean-server set-auth --disable

# Restart to apply changes
caribbean-server restart

# Check authentication status
caribbean-server status
```

See [Authentication Guide](authentication.md) for detailed configuration.

---

## PID File Management

Caribbean uses PID files to track running services:

| Service | PID File Location |
|---------|-------------------|
| Server | `~/.caribbean/server.pid` |
| Agent | `~/.caribbean/agent.pid` |

### Stop Mechanism

1. Send `SIGTERM` signal (graceful shutdown, 10-second timeout)
2. If timeout, send `SIGKILL` signal (forced shutdown)
3. Remove PID file

### Troubleshooting

#### Service Won't Stop

```bash
# Check if process is stuck
ps aux | grep -i caribbean

# Force kill if needed
kill -9 <PID>

# Remove stale PID file
rm ~/.caribbean/server.pid
```

#### Stale PID File

If you see a "stale PID file" error (service is not running but PID file exists):

```bash
rm ~/.caribbean/server.pid
caribbean-server start
```

#### Service Won't Start

```bash
# Check if already running
caribbean-server status

# If "already running" but service is actually down
rm ~/.caribbean/server.pid
caribbean-server start
```

---

## Systemd Integration

For production deployments, Caribbean can be managed via systemd.

### Server Service

Create `/etc/systemd/system/caribbean-server.service`:

```ini
[Unit]
Description=Caribbean Server
After=network.target

[Service]
Type=simple
User=caribbean
WorkingDirectory=/opt/caribbean
Environment=NODE_ENV=production
ExecStart=/usr/local/bin/caribbean-server start --config /etc/caribbean/server.json
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Agent Service

Create `/etc/systemd/system/caribbean-agent.service`:

```ini
[Unit]
Description=Caribbean Agent
After=network.target

[Service]
Type=simple
User=caribbean
WorkingDirectory=/opt/caribbean
Environment=NODE_ENV=production
ExecStart=/usr/local/bin/caribbean-agent start --config /etc/caribbean/agent.json
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Install and Start

```bash
# Add user
sudo useradd -r -s /bin/false caribbean

# Install binaries
sudo pnpm install --global /path/to/caribbean

# Copy configuration
sudo mkdir -p /etc/caribbean
sudo cp server.json /etc/caribbean/
sudo cp agent.json /etc/caribbean/
sudo chown -R caribbean:caribbean /etc/caribbean

# Reload systemd and start services
sudo systemctl daemon-reload
sudo systemctl enable caribbean-server
sudo systemctl enable caribbean-agent
sudo systemctl start caribbean-server
sudo systemctl start caribbean-agent
```
