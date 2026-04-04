# Caribbean


> OpenClaw 集群管理服务 - 实时监控、统一管理、智能调度

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 简介

Caribbean 是专为 [OpenClaw](https://github.com/allenai/openclaw) 设计的集群管理解决方案。采用轻量级 Agent + 中心化 Server 架构，通过 WebSocket 实现双向实时通信，轻松监控和管理分布式的 OpenClaw 节点。

### 核心特性

- 轻量级 Agent，单进程运行，资源占用极低
- WebSocket 实时双向通信，支持状态上报和远程指令
- React + Vite 现代化 Web 仪表盘
- OpenClaw Gateway 状态监控与智能诊断
- 一键自动修复常见 OpenClaw 配置问题
- Token 认证（Agent）+ 用户名密码登录（Web UI）

## 架构

```
┌─────────────────────────────────────────────────┐
│                 Caribbean Server                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ REST API │  │   WS Hub │  │   Web UI     │  │
│  │  :3000   │  │   :8080  │  │  (React)     │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │        数据持久化 (SQLite/PostgreSQL)      │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                         ▲
                   WebSocket (双向)
          ┌──────────────┼──────────────┐
          │              │              │
   ┌──────┴─────┐ ┌──────┴─────┐ ┌──────┴─────┐
   │  Agent     │ │  Agent     │ │  Agent     │
   │ + OpenClaw │ │ + OpenClaw │ │ + OpenClaw │
   └────────────┘ └────────────┘ └────────────┘
```

## 快速开始

### 前置要求

- Node.js 18+
- pnpm

### 一键启动

```bash
pnpm install
./start.sh
```

### 手动启动

```bash
# 构建
cd apps/server && pnpm run build:all

# 初始化配置
pnpm init

# 启动
npm start
```

启动后访问：
- **Web UI**：http://localhost:3000
- **WebSocket**：ws://localhost:8080

### 部署 Agent

在 OpenClaw 节点上：

```bash
caribbean-agent init --server ws://your-server:8080
caribbean-agent start
```

## 文档

详细文档请查看 [docs/](docs/) 目录：

| 文档 | 说明 |
|------|------|
| [架构设计](docs/architecture.md) | 技术栈选型、项目结构、架构详解 |
| [开发指南](docs/development.md) | 本地开发环境搭建、构建与测试 |
| [部署指南](docs/deployment.md) | Docker、Kubernetes、Systemd 部署 |
| [配置说明](docs/configuration.md) | Agent / Server 配置文件详解 |
| [认证指南](docs/authentication.md) | Token 认证、JWT、安全最佳实践 |
| [通信协议](docs/protocol.md) | WebSocket 协议、消息格式、事件定义 |
| [API 文档](docs/api.md) | REST API 端点与 WebSocket 接口 |
| [服务管理](docs/service-management.md) | CLI 命令、PID 管理、Systemd 集成 |
| [OpenClaw 监控](docs/openclaw-monitoring.md) | Gateway 状态监控、智能诊断、自动修复 |

## 许可证

[MIT](LICENSE)
