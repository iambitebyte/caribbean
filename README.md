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
- **📊 可视化监控** - 基于 React + Vite 的现代化 Web 仪表盘
- **⚡ Gateway 监控** - Agent 端主动验证 OpenClaw Gateway 状态
- **🔍 智能诊断** - 自动检测 Doctor Warnings 和配置问题
- **🔧 自动修复** - 一键修复常见 OpenClaw 配置问题
- **🎯 智能告警** - 节点离线、资源不足自动通知
- **🔒 安全传输** - 支持 TLS 加密和 Token 认证
- **📦 一键部署** - 提供 CLI 工具和 Docker 镜像

## 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                    Caribbean Server                     │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │   REST API   │  │ WebSocket Hub│  │  Web UI     │  │
│  │   (HTTP)     │  │  (实时通信)   │  │ (React)     │  │
│  └──────────────┘  └──────────────┘  └─────────────┘  │
│  ┌─────────────────────────────────────────────────┐   │
│  │              数据持久化 (SQLite/PostgreSQL)        │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │ WebSocket (双向) / HTTP
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

### 一键启动（推荐）

```bash
./start.sh
```

这将自动构建并启动 Caribbean Server（包含 Web UI）。

### 手动启动

```bash
# 1. 构建项目
cd apps/server
pnpm run build:all

# 2. 启动 Server
npm start
```

Server 将启动：
- WebSocket 服务：`ws://localhost:8080`（用于 Agent 连接）
- REST API + Web UI：`http://localhost:3000`

### 访问 Web UI

打开浏览器访问 `http://localhost:3000`，查看集群实时状态。

### 使用 Docker（可选）

```bash
docker run -d \
  --name caribbean-server \
  -p 3000:3000 \
  -p 8080:8080 \
  -v caribbean-data:/app/data \
  ghcr.io/your-org/caribbean-server:latest
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

打开浏览器访问 `http://localhost:3000`，即可查看集群实时状态。

**注意：Web Dashboard 已集成到 Server 中，无需单独启动！**

- WebSocket 服务：`ws://localhost:8080`（Agent 连接）
- REST API + Web UI：`http://localhost:3000`

### 4. 构建和部署

```bash
# 构建 Web Dashboard 和 Server
cd apps/server
pnpm run build:all

# 启动 Server（包含 Web UI）
npm start
```

### 5. 开发模式

```bash
# 启动 Web Dashboard 开发服务器（热重载）
cd apps/web
pnpm dev

# 启动 Server（另一个终端）
cd apps/server
npm start
```

开发模式下，Web Dashboard 运行在 `http://localhost:5173`，Server 运行在 `http://localhost:3000`。

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

# 检查 OpenClaw Gateway 详细状态
npx tsx apps/agent/src/cli.js openclaw-status

# 验证 OpenClaw 配置文件
npx tsx apps/agent/src/cli.js validate-openclaw
```

#### OpenClaw 配置管理

```bash
# 自动修复 OpenClaw 配置问题
npx tsx apps/agent/src/cli.js fix-openclaw

# 预览修复（不实际修改配置）
npx tsx apps/agent/src/cli.js fix-openclaw --dry-run

# 修复前创建备份
npx tsx apps/agent/src/cli.js fix-openclaw --backup
```

**自动修复功能支持：**
- Telegram 群组策略配置修复
- 缺失的 skills 自动填充
- 缺失的 agents 列表自动填充
- Gateway 端口配置修复
- 认证密钥自动生成

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
| **Server** | Fastify + WebSocket | 高性能 WebSocket 服务端 |
| **Web UI** | React 18 + Vite + TailwindCSS | 实时数据可视化仪表盘 |
| **数据库** | SQLite / PostgreSQL | 状态持久化存储 |
| **协议** | 自定义 JSON | 轻量级双向通信协议 |

## 项目结构

```
caribbean/
├── apps/
│   ├── agent/              # 节点 Agent
│   │   ├── src/
│   │   │   ├── collector.ts    # 状态采集器
│   │   │   ├── config-fixer.ts # OpenClaw 配置修复器
│   │   │   ├── websocket.ts    # WebSocket 客户端
│   │   │   ├── cli.ts          # CLI 命令
│   │   │   └── index.ts        # 入口
│   │   └── package.json
│   │
│   ├── server/             # 服务端
│   │   ├── src/
│   │   │   ├── websocket-hub.ts    # WebSocket Hub
│   │   │   ├── api.ts              # REST API
│   │   │   ├── node-manager.ts     # 节点管理
│   │   │   ├── database.ts         # 数据库管理
│   │   │   └── index.ts            # 入口
│   │   └── package.json
│   │
│   └── web/                # Web Dashboard
│       ├── src/
│       │   ├── components/          # UI 组件
│       │   │   ├── ui/             # shadcn/ui 组件
│       │   │   └── NodeCard.tsx    # 节点卡片
│       │   ├── lib/                # 工具函数
│       │   ├── types/              # 类型定义
│       │   ├── App.tsx             # 主应用
│       │   └── main.tsx            # 入口
│       ├── index.html
│       └── package.json
│
├── packages/
│   ├── shared/             # 共享类型定义
│   │   └── src/
│   │       ├── node.ts             # 节点类型（包含 OpenClawGatewayStatus）
│   │       └── index.ts
│   └── protocol/           # 通信协议规范
│
├── docs/                   # 文档
├── docker/                 # Docker 配置
└── start-dashboard.sh      # 一键启动脚本
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

**支持的远程指令：**

| 指令 | 参数 | 说明 |
|------|------|------|
| `restart_agent` | `{ agentId, force }` | 重启指定的 Agent |
| `fix_openclaw_config` | `{ backup, dryRun }` | 修复 OpenClaw 配置 |
| `get_openclaw_status` | - | 获取 OpenClaw 详细状态 |
| `validate_openclaw` | - | 验证 OpenClaw 配置 |

## API 接口

### REST API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/nodes` | 获取所有节点列表 |
| GET | `/api/nodes/:id` | 获取单个节点详情 |
| PATCH | `/api/nodes/:id/name` | 更新节点名称 |
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
  "history": {
    "retention": 5,        // 保留每个节点最近 5 条状态记录
    "cleanup": "auto"      // 自动清理历史记录
  },
  "auth": {
    "enabled": true,
    "tokens": ["your-secret-token"]
  }
}
```

## OpenClaw 状态保障

Caribbean Agent 提供了完整的 OpenClaw Gateway 状态监控和自动修复功能。

### 状态监控

Agent 会定期采集 OpenClaw Gateway 的状态，包括：

- **运行状态**：running / stopped / error
- **进程信息**：PID、端口、版本
- **健康检查**：综合评估整体健康状态
- **Doctor Warnings**：配置警告和建议
- **Troubles**：配置问题和错误

### 智能诊断

自动检测以下问题：

#### Doctor Warnings
- Telegram 群组策略配置问题
- 缺失的 skills 配置
- 缺失的 agents 配置

#### Troubles
- Gateway 端口配置缺失
- 认证配置缺失
- PID 文件缺失
- 配置文件解析错误

### 自动修复

使用 `fix-openclaw` 命令自动修复常见问题：

```bash
# 检查状态
caribbean-agent openclaw-status

# 自动修复（带备份）
caribbean-agent fix-openclaw --backup

# 预览修复（不实际修改）
caribbean-agent fix-openclaw --dry-run
```

**支持的自动修复：**

| 问题类型 | 自动修复方案 |
|---------|-------------|
| Telegram 群组策略为 allowlist 但列表为空 | 自动设置为 open 策略 |
| 缺失 skills 配置 | 自动添加默认 skills（shell, github, tmux, browser） |
| 缺失 agents 配置 | 自动添加默认 agents（reef, navigator, shell） |
| Gateway 端口缺失 | 自动设置默认端口 8000 |
| 认证配置缺失 | 自动生成 API Key |

### Web UI 显示

Dashboard 会实时显示每个节点的 OpenClaw 状态：

- **健康状态**：绿色（健康）/ 黄色（警告）/ 红色（错误）
- **问题数量**：显示当前警告和问题总数
- **图标指示**：使用不同图标区分严重级别
  - ⚠️ 警告级别问题
  - ❌ 错误级别问题
  - ℹ️ 信息级别问题

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
# 启动 Server
cd apps/server
pnpm run build
npm start

# 启动 Agent (另一个终端)
cd apps/agent
pnpm run build
npm start

# 启动 Web Dashboard 开发服务器 (另一个终端，可选)
cd apps/web
pnpm dev
```

或者使用构建脚本（生产模式）：
```bash
cd apps/server
pnpm run build:all
npm start
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
- [x] React Dashboard
- [x] OpenClaw Gateway 状态监控
- [x] OpenClaw 智能诊断（Doctor Warnings + Troubles）
- [x] OpenClaw 配置自动修复
- [x] 节点名称更新 API
- [x] 数据库历史记录自动清理（保留最近 5 条）
- [x] Web UI 详细状态显示（支持问题数量和严重级别）
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
