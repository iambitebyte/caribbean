# 🌴 Caribbean

> OpenClaw 集群管理服务 - 实时监控、统一管理、智能调度

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![WebSocket](https://img.shields.io/badge/WebSocket-Real--time-green.svg)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

## 简介

Caribbean 是专为 [OpenClaw](https://github.com/allenai/openclaw) 设计的集群管理解决方案。它采用轻量级 Agent + 中心化 Server 架构，通过 WebSocket 实现双向实时通信，让你能够轻松监控和管理分布在多台服务器上的 OpenClaw 节点。

### ✨ 核心特性

- **🚀 轻量级 Agent** - 单二进制文件，资源占用极低 (< 50MB 内存)
- **🔄 实时双向通信** - WebSocket 保持长连接，支持状态上报和远程指令
- **📊 可视化监控** - 基于 Next.js 的现代化 Web 仪表盘
- **🎯 智能告警** - 节点离线、资源不足自动通知
- **🔒 安全传输** - 支持 TLS 加密和 Token 认证
- **📦 一键部署** - 提供 CLI 工具和 Docker 镜像

## 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                    Caribbean Server                     │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │   REST API   │  │ WebSocket Hub│  │  Next.js    │  │
│  │   (HTTP)     │  │  (实时通信)   │  │   Web UI    │  │
│  └──────────────┘  └──────────────┘  └─────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              数据持久化 (SQLite/PostgreSQL)        │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           ▲
                           │ WebSocket (双向)
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────┴──────┐   ┌───────┴──────┐   ┌───────┴──────┐
│   Node 01    │   │   Node 02    │   │   Node 03    │
│ ┌──────────┐ │   │ ┌──────────┐ │   │ ┌──────────┐ │
│ │ Caribbean│ │   │ │ Caribbean│ │   │ │ Caribbean│ │
│ │  Agent   │ │   │ │  Agent   │ │   │ │  Agent   │ │
│ └──────────┘ │   │ └──────────┘ │   │ └──────────┘ │
│ ┌──────────┐ │   │ ┌──────────┐ │   │ ┌──────────┐ │
│ │ OpenClaw │ │   │ │ OpenClaw │ │   │ │ OpenClaw │ │
│ │ Gateway  │ │   │ │ Gateway  │ │   │ │ Gateway  │ │
│ └──────────┘ │   │ └──────────┘ │   │ └──────────┘ │
└──────────────┘   └──────────────┘   └──────────────┘
```

## 快速开始

### 1. 启动 Server

```bash
# 使用 Docker 快速启动
docker run -d \
  --name caribbean-server \
  -p 3000:3000 \
  -p 8080:8080 \
  -v caribbean-data:/app/data \
  ghcr.io/your-org/caribbean-server:latest

# 或使用 npm
npx @caribbean/server@latest
```

### 2. 部署 Agent

```bash
# 在 OpenClaw 节点上安装 Agent
curl -fsSL https://caribbean.dev/install.sh | bash

# 配置并启动
caribbean-agent init --server ws://your-server:8080
caribbean-agent start
```

### 3. 访问仪表盘

打开浏览器访问 `http://your-server:3000`，即可查看集群实时状态。

### 4. 服务管理

Caribbean 提供了完整的服务管理命令，包括启动、停止和重启功能。

#### 启动服务

```bash
# 启动 Server
npx tsx apps/server/src/cli.js start

# 启动 Agent
npx tsx apps/agent/src/cli.js start
```

#### 停止服务

```bash
# 停止 Server (同时停止 WebSocket 8080 和 REST API 3000)
npx tsx apps/server/src/cli.js stop

# 停止 Agent
npx tsx apps/agent/src/cli.js stop
```

#### 重启服务

```bash
# 重启 Server
npx tsx apps/server/src/cli.js restart

# 重启 Agent
npx tsx apps/agent/src/cli.js restart
```

#### 查看服务状态

```bash
# 查看 Server 配置状态
npx tsx apps/server/src/cli.js status

# 查看 Agent 配置状态
npx tsx apps/agent/src/cli.js status
```

#### 查看帮助

```bash
# 查看 Server 命令帮助
npx tsx apps/server/src/cli.js --help

# 查看 Agent 命令帮助
npx tsx apps/agent/src/cli.js --help
```

#### PID 文件管理

Caribbean 使用 PID 文件跟踪运行中的服务：

- **Server PID**: `~/.caribbean/server.pid`
- **Agent PID**: `~/.caribbean/agent.pid`

停止机制：
- 首先发送 SIGTERM 信号（优雅停止，10 秒超时）
- 如果超时，发送 SIGKILL 信号（强制停止）

防重复启动：
- 启动前检查 PID 文件
- 如果服务已运行，拒绝启动并提示使用 stop 命令

## 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| **Agent** | TypeScript + Bun | 轻量级守护进程，采集节点状态 |
| **Server** | Fastify + Socket.io | 高性能 WebSocket 服务端 |
| **Web UI** | Next.js 15 + Tailwind | 实时数据可视化仪表盘 |
| **数据库** | SQLite / PostgreSQL | 状态持久化存储 |
| **协议** | 自定义 JSON | 轻量级双向通信协议 |

## 项目结构

```
caribbean/
├── apps/
│   ├── agent/              # 节点 Agent
│   │   ├── src/
│   │   │   ├── collector.ts    # 状态采集器
│   │   │   ├── websocket.ts    # WebSocket 客户端
│   │   │   └── index.ts        # 入口
│   │   └── package.json
│   │
│   └── server/             # 服务端 + Web UI
│       ├── src/
│       │   ├── websocket/      # WebSocket Hub
│       │   ├── api/            # REST API
│       │   └── web/            # Next.js 应用
│       └── package.json
│
├── packages/
│   ├── shared/             # 共享类型定义
│   └── protocol/           # 通信协议规范
│
├── docs/                   # 文档
├── docker/                 # Docker 配置
└── scripts/                # 部署脚本
```

## 通信协议

### Agent -> Server (状态上报)

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
      "skills": ["shell", "github", "tmux", "browser"]
    }
  }
}
```

### Server -> Agent (远程指令)

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

## API 接口

### REST API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/nodes` | 获取所有节点列表 |
| GET | `/api/nodes/:id` | 获取单个节点详情 |
| GET | `/api/nodes/:id/status` | 获取节点历史状态 |
| POST | `/api/nodes/:id/command` | 向节点发送指令 |
| GET | `/api/health` | 服务健康检查 |

### WebSocket 事件

| 事件 | 方向 | 描述 |
|------|------|------|
| `agent:connect` | C->S | Agent 连接注册 |
| `agent:heartbeat` | C->S | 心跳/状态上报 |
| `agent:disconnect` | C->S | 断开连接 |
| `server:command` | S->C | 下发远程指令 |
| `dashboard:subscribe` | C->S | 仪表盘订阅更新 |
| `dashboard:broadcast` | S->C | 广播状态变更 |

## 配置说明

### Agent 配置 (`caribbean-agent.json`)

```json
{
  "server": {
    "url": "ws://localhost:8080",
    "reconnectInterval": 5000,
    "heartbeatInterval": 30000
  },
  "node": {
    "id": "auto",           // auto 或自定义 ID
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

### Server 配置 (`caribbean-server.json`)

```json
{
  "websocket": {
    "port": 8080,
    "path": "/ws/agent",
    "maxConnections": 1000
  },
  "web": {
    "port": 3000,
    "title": "Caribbean Dashboard"
  },
  "database": {
    "type": "sqlite",       // sqlite 或 postgresql
    "path": "./data/caribbean.db"
  },
  "auth": {
    "enabled": true,
    "tokens": ["your-secret-token"]
  }
}
```

## 开发指南

### 环境准备

```bash
# 克隆仓库
git clone https://github.com/your-org/caribbean.git
cd caribbean

# 安装依赖 (使用 pnpm)
pnpm install

# 构建所有包
pnpm build
```

### 本地开发

```bash
# 启动 Server (包含 Web UI)
pnpm --filter @caribbean/server dev

# 启动 Agent (另一个终端)
pnpm --filter @caribbean/agent dev -- --server ws://localhost:8080
```

### 运行测试

```bash
# 单元测试
pnpm test

# E2E 测试
pnpm test:e2e

# 代码检查
pnpm lint
```

## 部署方案

### Docker Compose (推荐)

```yaml
version: '3.8'
services:
  caribbean-server:
    image: ghcr.io/your-org/caribbean-server:latest
    ports:
      - "3000:3000"    # Web UI
      - "8080:8080"    # WebSocket
    volumes:
      - ./data:/app/data
    environment:
      - CARIBBEAN_AUTH_TOKEN=${TOKEN}
    restart: unless-stopped

  caribbean-agent:
    image: ghcr.io/your-org/caribbean-agent:latest
    environment:
      - CARIBBEAN_SERVER_URL=ws://caribbean-server:8080
      - CARIBBEAN_AUTH_TOKEN=${TOKEN}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    restart: unless-stopped
```

### Kubernetes

```bash
# 部署 Server
kubectl apply -f k8s/server-deployment.yaml
kubectl apply -f k8s/server-service.yaml

# 部署 Agent DaemonSet (每个节点自动部署)
kubectl apply -f k8s/agent-daemonset.yaml
```

## 路线图

- [x] 基础架构设计
- [x] Agent 状态采集
- [x] WebSocket 双向通信
- [x] REST API 接口
- [x] 数据持久化层
- [x] 服务管理命令（stop/restart）
- [ ] Next.js 仪表盘
- [ ] 告警系统
- [ ] 日志聚合
- [ ] 性能分析
- [ ] 多集群支持

## 贡献指南

我们欢迎所有形式的贡献！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

请确保：
- 代码通过 TypeScript 类型检查
- 所有测试通过
- 提交信息遵循 [Conventional Commits](https://conventionalcommits.org/)

## 许可证

[MIT](LICENSE) © Caribbean Contributors
