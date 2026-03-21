# Caribbean Web Dashboard - 快速开始

## 功能特性

✅ 实时节点监控
✅ 系统资源跟踪（CPU、内存、运行时间）
✅ Agent 状态显示
✅ 连接状态指示器
✅ 自动刷新（每 10 秒）
✅ 响应式网格布局
✅ 现代化 UI（基于 shadcn/ui 和 TailwindCSS）
✅ 已集成到 Server，无需单独部署

## 快速启动

### 生产模式（推荐）

```bash
cd apps/server
pnpm run build:all
npm start
```

Server 将启动：
- WebSocket 服务：`ws://localhost:8080`（Agent 连接）
- REST API + Web UI：`http://localhost:3000`

### 开发模式

```bash
# 终端 1: 启动 Web Dashboard 开发服务器（热重载）
cd apps/web
pnpm dev

# 终端 2: 启动 Server
cd apps/server
npm start
```

开发模式下，Web Dashboard 运行在 `http://localhost:5173`，Server 运行在 `http://localhost:3000`。

### 访问 Dashboard

**生产模式：** `http://localhost:3000`
**开发模式：** `http://localhost:5173`

## 一键启动（生产模式）

```bash
# 构建并启动
cd apps/server
pnpm run build:all
npm start
```

访问 `http://localhost:3000` 即可查看 Dashboard。

## 界面说明

### 顶部统计卡片

- **Total Nodes**：集群中节点总数
- **Total Agents**：活跃的 Agent 总数
- **Total Memory**：所有连接节点的内存总量
- **Disconnected**：离线节点数量

### 节点卡片

每个节点显示：
- 节点名称和 IP 地址
- 连接状态（绿色/红色徽章）
- 操作系统和版本
- CPU 使用率和核心数
- 内存使用情况
- 运行时间
- Agent 数量
- 最后在线时间

## API 端点

Web Dashboard 通过以下 API 端点获取数据：

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/health` | GET | 服务器健康检查 |
| `/api/nodes` | GET | 获取所有节点列表 |
| `/api/nodes/:id` | GET | 获取单个节点详情 |
| `/api/nodes/:id/status` | GET | 获取节点状态 |
| `/api/nodes/:id/command` | POST | 向节点发送指令 |
| `/api/stats` | GET | 获取集群统计信息 |

## 配置

### Vite 代理配置

开发环境下，Vite 会自动将 `/api` 请求代理到 `http://localhost:3000`：

```javascript
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true
    }
  }
}
```

### 主题配置

主题在 `src/index.css` 中定义，支持亮色和暗色模式。

## 开发

### 修改代码

代码修改后，Vite 的 HMR（热模块替换）会自动更新页面。

### 构建生产版本

```bash
pnpm build
```

### 预览生产版本

```bash
pnpm preview
```

## 故障排除

### API 请求失败

1. 确保 Server 正在运行（`http://localhost:3000`）
2. 检查浏览器控制台错误
3. 验证 CORS 配置

### 样式问题

1. 清除浏览器缓存
2. 重启开发服务器

## 下一步

- 查看 [DEVELOPMENT.md](./DEVELOPMENT.md) 了解详细的开发指南
- 查看 [README.md](../README.md) 了解项目整体架构

## 技术支持

如有问题，请提交 Issue 到项目仓库。
