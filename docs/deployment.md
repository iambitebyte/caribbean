# Deployment Guide

## Table of Contents

For detailed authentication configuration and security best practices, see the [Authentication Guide](authentication.md).

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configure Authentication](#configure-authentication)
- [Docker Deployment](#docker-deployment)
- [Docker Compose](#docker-compose)
- [Kubernetes](#kubernetes)
- [Systemd Service](#systemd-service)
- [Nginx Reverse Proxy](#nginx-reverse-proxy)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js 18+ or Bun runtime
- pnpm package manager
- (Optional) Docker for containerized deployment
- (Optional) Kubernetes cluster for K8s deployment

## Quick Start

### 1. Install Dependencies

```bash
# Clone the repository
git clone https://github.com/your-org/caribbean.git
cd caribbean

# Install dependencies with pnpm
pnpm install

# Build all packages
pnpm build
```

### 2. Start Server

```bash
# Initialize server configuration
pnpm init

# Start the server
npm start
```

The server will start on:
- WebSocket: `ws://localhost:8080/ws/agent`
- REST API: `http://localhost:3000/api`

### 3. Deploy Agent

```bash
# Initialize agent configuration
npx @caribbean/agent init --server ws://localhost:8080

# Start the agent
npx @caribbean/agent start
```

### Configure Authentication

Caribbean provides flexible authentication options for both Agent connections and Web UI access.

#### Enable Web UI Authentication

To secure the Web Dashboard with username and password:

```bash
# Set username and password
caribbean-server set-auth --username admin --password your-secure-password

# Restart server to apply changes
caribbean-server restart

# Verify authentication status
caribbean-server status
```

#### Disable Web UI Authentication

For internal networks where authentication is not needed:

```bash
caribbean-server set-auth --disable
caribbean-server restart
```

#### Configure Agent Token Authentication

During initialization, set a token for Agent connections:

```bash
caribbean-server init --token your-secret-token
```

Then configure agents with the same token:

```bash
caribbean-agent init --token your-secret-token
```

For detailed authentication configuration and security best practices, see the [Authentication Guide](authentication.md).

## Docker Deployment

### Build Docker Images

```bash
# Build Server Image
docker build -t caribbean-server:latest -f docker/Dockerfile.server .

# Build Agent Image
docker build -t caribbean-agent:latest -f docker/Dockerfile.agent .
```

### Run Server

```bash
docker run -d \
  --name caribbean-server \
  -p 8080:8080 \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e CARIBBEAN_AUTH_TOKEN=your-secret-token \
  caribbean-server:latest
```

### Run Agent

```bash
docker run -d \
  --name caribbean-agent \
  -e CARIBBEAN_SERVER_URL=ws://caribbean-server:8080 \
  -e CARIBBEAN_AUTH_TOKEN=your-secret-token \
  caribbean-agent:latest
```

## Docker Compose

### Create docker-compose.yml

```yaml
version: '3.8'

services:
  caribbean-server:
    image: caribbean-server:latest
    container_name: caribbean-server
    ports:
      - "8080:8080"  # WebSocket
      - "3000:3000"  # REST API
    volumes:
      - ./data:/app/data
    environment:
      - CARIBBEAN_AUTH_TOKEN=${CARIBBEAN_AUTH_TOKEN}
    restart: unless-stopped
    networks:
      - caribbean-network

  caribbean-agent-1:
    image: caribbean-agent:latest
    container_name: caribbean-agent-1
    environment:
      - CARIBBEAN_SERVER_URL=ws://caribbean-server:8080
      - CARIBBEAN_AUTH_TOKEN=${CARIBBEAN_AUTH_TOKEN}
      - CARIBBEAN_NODE_NAME=agent-1
    restart: unless-stopped
    depends_on:
      - caribbean-server
    networks:
      - caribbean-network

  caribbean-agent-2:
    image: caribbean-agent:latest
    container_name: caribbean-agent-2
    environment:
      - CARIBBEAN_SERVER_URL=ws://caribbean-server:8080
      - CARIBBEAN_AUTH_TOKEN=${CARIBBEAN_AUTH_TOKEN}
      - CARIBBEAN_NODE_NAME=agent-2
    restart: unless-stopped
    depends_on:
      - caribbean-server
    networks:
      - caribbean-network

networks:
  caribbean-network:
    driver: bridge
```

### Start Services

```bash
# Create .env file
cat > .env << EOF
CARIBBEAN_AUTH_TOKEN=your-secret-token-here
EOF

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Kubernetes

### Deploy Server

Create `k8s/server-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: caribbean-server
  labels:
    app: caribbean-server
spec:
  replicas: 1
  selector:
    matchLabels:
      app: caribbean-server
  template:
    metadata:
      labels:
        app: caribbean-server
    spec:
      containers:
      - name: server
        image: caribbean-server:latest
        ports:
        - containerPort: 8080
          name: websocket
        - containerPort: 3000
          name: api
        env:
        - name: CARIBBEAN_AUTH_TOKEN
          valueFrom:
            secretKeyRef:
              name: caribbean-secrets
              key: auth-token
        volumeMounts:
        - name: data
          mountPath: /app/data
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: caribbean-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: caribbean-server
spec:
  selector:
    app: caribbean-server
  ports:
  - port: 8080
    targetPort: 8080
    name: websocket
  - port: 3000
    targetPort: 3000
    name: api
  type: LoadBalancer
```

### Deploy Agent DaemonSet

Create `k8s/agent-daemonset.yaml`:

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: caribbean-agent
  labels:
    app: caribbean-agent
spec:
  selector:
    matchLabels:
      app: caribbean-agent
  template:
    metadata:
      labels:
        app: caribbean-agent
    spec:
      hostNetwork: true
      containers:
      - name: agent
        image: caribbean-agent:latest
        env:
        - name: CARIBBEAN_SERVER_URL
          value: "ws://caribbean-server:8080"
        - name: CARIBBEAN_AUTH_TOKEN
          valueFrom:
            secretKeyRef:
              name: caribbean-secrets
              key: auth-token
        - name: CARIBBEAN_NODE_NAME
          valueFrom:
            fieldRef:
              fieldPath: spec.nodeName
        resources:
          requests:
            memory: "50Mi"
            cpu: "50m"
          limits:
            memory: "100Mi"
            cpu: "200m"
```

### Create Secrets and Deploy

```bash
# Create secret
kubectl create secret generic caribbean-secrets \
  --from-literal=auth-token=your-secret-token

# Create PersistentVolumeClaim
kubectl apply -f k8s/pvc.yaml

# Deploy server
kubectl apply -f k8s/server-deployment.yaml

# Deploy agent on all nodes
kubectl apply -f k8s/agent-daemonset.yaml

# Check status
kubectl get pods -l app=caribbean-server
kubectl get pods -l app=caribbean-agent
```

## Systemd Service

### Create Server Service

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

### Create Agent Service

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

# Check status
sudo systemctl status caribbean-server
sudo systemctl status caribbean-agent

# Stop services
sudo systemctl stop caribbean-server
sudo systemctl stop caribbean-agent

# Restart services
sudo systemctl restart caribbean-server
sudo systemctl restart caribbean-agent
```

### Service Management Commands

Caribbean provides CLI commands for service management outside of systemd:

```bash
# Start services
caribbean-server start
caribbean-agent start

# Stop services
caribbean-server stop    # Stops WebSocket (8080) and REST API (3000)
caribbean-agent stop     # Stops the agent

# Restart services
caribbean-server restart
caribbean-agent restart

# View status
caribbean-server status
caribbean-agent status
```

#### PID Management

Caribbean uses PID files to track running services:

- **Server PID**: `~/.caribbean/server.pid`
- **Agent PID**: `~/.caribbean/agent.pid`

#### Stop Mechanism

1. Send SIGTERM signal (graceful shutdown, 10s timeout)
2. If timeout, send SIGKILL signal (forced shutdown)
3. Remove PID file

#### Duplicate Start Prevention

- Checks PID file before starting
- Rejects start if service is already running
- Cleans up stale PID files automatically

#### Example Usage

```bash
# Start server
npx tsx apps/server/src/cli.js start

# Check PID
cat ~/.caribbean/server.pid

# Stop server (graceful)
npx tsx apps/server/src/cli.js stop

# Restart server
npx tsx apps/server/src/cli.js restart

# View help
npx tsx apps/server/src/cli.js --help
```

## Nginx Reverse Proxy

For production deployments, it's recommended to use Nginx as a reverse proxy to handle both the REST API (port 3000) and WebSocket connections (port 8080).

### Basic Configuration

Create `/etc/nginx/sites-available/caribbean`:

```nginx
server {
  server_name your-domain.com;
  listen 80;

  # WebSocket endpoint for Agent connections
  location /ws/agent {
    proxy_pass http://127.0.0.1:8080;

    # Required for WebSocket
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # Pass original headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

    # Timeout settings for WebSocket long connections
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
  }

  # REST API and Web UI
  location / {
    proxy_pass http://127.0.0.1:3000;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

### HTTPS Configuration with Let's Encrypt

```nginx
server {
  server_name your-domain.com;
  listen 80;
  return 301 https://$server_name$request_uri;
}

server {
  server_name your-domain.com;
  listen 443 ssl http2;

  # SSL certificates (from Let's Encrypt)
  ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

  # SSL configuration
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;

  # WebSocket endpoint for Agent connections
  location /ws/agent {
    proxy_pass http://127.0.0.1:8080;

    # Required for WebSocket
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # Pass original headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Timeout settings for WebSocket long connections
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
  }

  # REST API and Web UI
  location / {
    proxy_pass http://127.0.0.1:3000;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

### Key Configuration Points

1. **WebSocket Path Matching**: `location /ws/agent` must be placed **before** `location /` because nginx matches the most specific path first
2. **No Trailing Slash in proxy_pass**: `http://127.0.0.1:8080` (not `http://127.0.0.1:8080/`) to preserve the full path
3. **WebSocket Headers**:
   - `Upgrade: websocket` and `Connection: upgrade` are required for WebSocket handshake
   - `proxy_http_version 1.1` is required (WebSocket doesn't work with HTTP/1.0)
4. **Timeout Settings**:
   - `proxy_read_timeout 86400s` (24 hours) prevents disconnection of long-lived connections
   - `proxy_send_timeout 86400s` (24 hours) for sending large payloads

### Deploying Nginx Configuration

```bash
# Create configuration file
sudo nano /etc/nginx/sites-available/caribbean

# Create symlink to enable site
sudo ln -s /etc/nginx/sites-available/caribbean /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# Enable nginx on boot
sudo systemctl enable nginx
```

### Testing WebSocket Connection

After deploying with Nginx, test the WebSocket endpoint:

```bash
# Test WebSocket handshake
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  http://your-domain.com/ws/agent

# Expected response: HTTP/1.1 101 Switching Protocols
```

### Updating Agent Configuration

When using Nginx reverse proxy, configure agents to connect through the proxy:

```bash
# Initialize agent with proxy URL
caribbean-agent init --server wss://your-domain.com/ws/agent

# Or override server URL when starting
caribbean-agent start --server wss://your-domain.com/ws/agent
```

### Troubleshooting Nginx

**WebSocket 404 Error**

If agents get 404 errors:

```bash
# Check nginx error logs
sudo tail -f /var/log/nginx/error.log

# Verify path order (ws/agent before /)
cat /etc/nginx/sites-available/caribbean | grep location

# Test nginx config
sudo nginx -t
```

**WebSocket Connection Timeout**

If connections timeout frequently:

```nginx
# Increase timeout values in nginx config
proxy_read_timeout 86400s;
proxy_send_timeout 86400s;
```

**Connection Refused**

```bash
# Check if backend services are running
curl http://localhost:8080/ws/agent
curl http://localhost:3000/api

# Check nginx is running
sudo systemctl status nginx

# Check ports are listening
sudo netstat -tlnp | grep -E ':(80|443|3000|8080)'
```

## Configuration

### Server Configuration

Location: `~/.caribbean/server.json`

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
    "description": "Keeps only last 5 status records per node"
  },
  "auth": {
    "enabled": true,
    "tokens": ["your-agent-token"],
    "user": {
      "username": "admin",
      "password": "your-webui-password"
    },
    "jwtSecret": "caribbean-jwt-secret-auto-generated"
  }
}
```

### Agent Configuration

Location: `~/.caribbean/agent.json`

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

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CARIBBEAN_AUTH_TOKEN` | Authentication token | - |
| `CARIBBEAN_SERVER_URL` | Server WebSocket URL | ws://localhost:8080 |
| `CARIBBEAN_NODE_NAME` | Node name | auto-generated |
| `NODE_ENV` | Environment | development |

## Troubleshooting

### Server Issues

**Server won't start**

```bash
# Check logs
journalctl -u caribbean-server -n 50

# Check port conflicts
sudo netstat -tlnp | grep -E ':(8080|3000)'
```

**Agents not connecting**

```bash
# Check WebSocket connectivity
wscat -c ws://localhost:8080/ws/agent

# Check firewall rules
sudo ufw status
```

### Agent Issues

**Agent can't connect to server**

```bash
# Check server URL
cat ~/.caribbean/agent.json

# Test network connectivity
ping server-host
telnet server-host 8080
```

**High memory usage**

```bash
# Check agent process
ps aux | grep caribbean-agent

# Monitor system resources
top -p $(pgrep caribbean-agent)
```

### Docker Issues

**Container won't start**

```bash
# Check logs
docker logs caribbean-server

# Inspect container
docker inspect caribbean-server

# Check network
docker network ls
docker network inspect caribbean-network
```

### Kubernetes Issues

**Pods not starting**

```bash
# Check pod status
kubectl get pods -l app=caribbean-server

# Describe pod
kubectl describe pod <pod-name>

# View logs
kubectl logs <pod-name>
```

**DaemonSet not creating pods**

```bash
# Check DaemonSet status
kubectl get daemonset caribbean-agent

# Check node labels
kubectl get nodes --show-labels
```

### Monitoring and Debugging

**Enable debug logging**

```bash
# Agent with debug mode (shows detailed WebSocket logs)
caribbean-agent start --debug
caribbean-agent start --debug --foreground

# Or restart with debug
caribbean-agent restart --debug
```

Debug logging provides:
- Connection details (URL, headers, local IP)
- WebSocket state changes (CONNECTING, OPEN, CLOSING, CLOSED)
- Message payloads (connect, heartbeat, command, ack)
- Error details with stack traces
- Connection close codes with meanings

**Database History Retention**

The database automatically manages historical data and node configuration:

- **Retention**: Only last 5 records per node in `status_history`
- **Cleanup**: Automatic cleanup after each heartbeat
- **Performance**: Keeps database size manageable
- **Configuration Persistence**: Node `name` and `tags` are permanently stored
- **Server Restart Resilience**: After server restart, nodes reconnect with their saved configuration
- **Custom Names**: Node names modified via Web Dashboard persist across server restarts

To verify retention:

```bash
# Connect to SQLite
sqlite3 data/caribbean.db

# Check history count per node
SELECT node_id, COUNT(*) as count
FROM status_history
GROUP BY node_id;
```

**Database Migrations**

The system includes an automated migration system to manage database schema changes:

- **Automatic Execution**: Migrations run automatically on server startup
- **Version Tracking**: Tracks which migrations have been executed in the `migrations` table
- **Backward Compatible**: Existing databases are upgraded seamlessly without manual intervention
- **Idempotent**: Each migration runs only once, even if server restarts multiple times

**View Applied Migrations:**

```bash
# Connect to SQLite
sqlite3 data/caribbean.db

# View migration history
SELECT version, name, executed_at FROM migrations ORDER BY version;
```

**Manual Migration (if needed):**

If you need to manually check or fix migration state:

```bash
# Stop server
caribbean-server stop

# Backup database
cp data/caribbean.db data/caribbean.db.backup

# Check migration table
sqlite3 data/caribbean.db "SELECT * FROM migrations;"

# Start server again (will run any pending migrations)
caribbean-server start
```

**Check connection status**

```bash
# View server logs
caribbean-server status

# View agent logs
caribbean-agent status
```

### Common Solutions

1. **Port conflicts**: Change ports in configuration
2. **Firewall issues**: Open required ports (8080, 3000)
3. **Authentication failures**: Verify token matches server config
4. **Network issues**: Check DNS resolution and firewall rules
5. **Resource limits**: Adjust memory/CPU limits in K8s/Docker

#### Service Won't Stop

```bash
# Check if process is stuck
ps aux | grep -i caribbean

# Force kill if needed
kill -9 <PID>

# Remove stale PID file
rm ~/.caribbean/server.pid
rm ~/.caribbean/agent.pid
```

#### Stale PID File

```bash
# If you see "stale PID file" error
# The service is not running but PID file exists

# Remove the PID file and start again
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

## Production Checklist

### Security
- [ ] Enable Web UI authentication for public deployments
- [ ] Set strong username and password (min 12 characters, mixed case)
- [ ] Enable Agent token authentication
- [ ] Use cryptographically strong tokens (min 32 characters)
- [ ] Configure firewall rules to restrict access
- [ ] Use HTTPS for API endpoints in production
- [ ] Implement rate limiting
- [ ] Rotate passwords and tokens regularly

### Reliability
- [ ] Set up log rotation
- [ ] Configure resource limits
- [ ] Set up monitoring and alerting
- [ ] Configure backups
- [ ] Set up failover for high availability
- [ ] Document emergency procedures

### Functionality
- [ ] Verify OpenClaw Gateway status monitoring is working
- [ ] Test database retention policy (last 5 records)
- [ ] Set up alerts for Gateway offline status
- [ ] Verify database migrations run successfully on startup
- [ ] Backup database before major version upgrades
- [ ] Test database upgrade path from previous version
- [ ] Test authentication flow (login, token expiration, logout)
- [ ] Verify 401 errors trigger proper UI feedback

## Support

For issues and questions:
- GitHub Issues: https://github.com/your-org/caribbean/issues
- Documentation: https://caribbean.dev/docs
