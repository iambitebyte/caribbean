# Caribbean Web Dashboard - 开发指南

## 项目概述

Caribbean Web Dashboard 是一个基于 React + Vite + TailwindCSS 的单页应用，用于监控和管理 Caribbean 集群节点。

## 技术栈

- **React 18.3** - UI 框架
- **Vite 5.3** - 构建工具和开发服务器
- **TypeScript 5.5** - 类型安全
- **TailwindCSS 3.4** - CSS 框架
- **Lucide React** - 图标库
- **shadcn/ui** - UI 组件库（定制实现）

## 项目结构

```
apps/web/
├── src/
│   ├── components/          # React 组件
│   │   ├── ui/             # 基础 UI 组件（Button, Card, Badge）
│   │   └── NodeCard.tsx    # 节点卡片组件
│   ├── lib/                # 工具函数
│   │   ├── api.ts          # API 调用
│   │   └── utils.ts        # 通用工具（cn 函数）
│   ├── types/              # TypeScript 类型定义
│   │   └── index.ts        # NodeInfo 等类型
│   ├── App.tsx             # 主应用组件
│   ├── main.tsx            # 应用入口
│   └── index.css           # 全局样式（Tailwind）
├── index.html              # HTML 模板
├── vite.config.ts          # Vite 配置
├── tailwind.config.ts      # Tailwind 配置
├── tsconfig.json           # TypeScript 配置
└── package.json
```

## 开发环境

### 前置要求

- Node.js 18+
- pnpm 8+

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

应用将在 `http://localhost:5173` 启动。

### 构建

```bash
pnpm build
```

构建产物将输出到 `dist/` 目录。

### 预览生产构建

```bash
pnpm preview
```

## API 集成

Web Dashboard 通过 Vite 代理与 Caribbean Server 的 REST API 通信：

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

### 可用 API 端点

- `GET /api/health` - 服务器健康检查
- `GET /api/nodes` - 获取所有节点列表
- `GET /api/nodes/:id` - 获取单个节点详情
- `GET /api/nodes/:id/status` - 获取节点状态
- `POST /api/nodes/:id/command` - 向节点发送指令
- `GET /api/stats` - 获取集群统计信息

### API 调用示例

```typescript
import { fetchNodes, fetchStats } from '@/lib/api'

// 获取所有节点
const nodes = await fetchNodes()

// 获取集群统计
const stats = await fetchStats()
```

## 组件开发

### 添加新的 UI 组件

1. 在 `src/components/ui/` 下创建组件文件
2. 使用 Tailwind CSS 进行样式设计
3. 遵循现有的组件模式（使用 `cn` 工具函数处理类名合并）

示例：

```typescript
import { cn } from '@/lib/utils'

export function MyComponent({ className, ...props }: MyComponentProps) {
  return (
    <div className={cn("base-classes", className)} {...props}>
      {/* 组件内容 */}
    </div>
  )
}
```

### 主题定制

在 `src/index.css` 中定义的 CSS 变量控制主题：

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  /* 更多变量... */
}
```

## 类型定义

所有 TypeScript 类型定义在 `src/types/index.ts` 中：

```typescript
export interface NodeInfo {
  id: string;
  hostname: string;
  ip: string;
  os: string;
  version: string;
  status: {
    memory: {
      total: number;
      used: number;
      free: number;
    };
    cpu: {
      usage: number;
      cores: number;
    };
    agents: {
      active: number;
      total: number;
    };
    uptime: number;
  };
  connected: boolean;
  lastSeen: number;
}
```

## 性能优化

- 使用 React.memo 优化组件渲染
- 使用 useMemo 和 useCallback 缓存计算和函数
- 图片和静态资源优化
- 代码分割（Vite 自动处理）

## 调试

### Chrome DevTools

在开发模式下，可以使用 React DevTools 和 Redux DevTools（如果使用）进行调试。

### Network 标签

查看 API 请求和响应：
1. 打开 Chrome DevTools (F12)
2. 切换到 Network 标签
3. 筛选 XHR/Fetch 请求查看 API 调用

## 部署

### 生产构建

```bash
pnpm build
```

### 使用 Nginx 部署

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /path/to/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 常见问题

### CORS 错误

确保 Server 已启用 CORS（已在 `apps/server/src/api.ts` 中配置）。

### API 请求失败

1. 检查 Server 是否运行在 `http://localhost:3000`
2. 检查 Vite 代理配置
3. 查看浏览器控制台错误信息

### 样式不生效

1. 确保 Tailwind CSS 已正确配置
2. 检查 `tailwind.config.ts` 中的 content 配置
3. 清除浏览器缓存

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT
