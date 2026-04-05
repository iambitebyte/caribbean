# npm 发布指南

## 概述

Caribbean 使用 pnpm workspace 管理多包，发布 4 个包到 npm：

| 包名 | 说明 | 依赖 |
|------|------|------|
| `@openclaw-caribbean/shared` | 共享类型和工具函数 | 无 |
| `@openclaw-caribbean/protocol` | WebSocket 消息协议 | shared |
| `@openclaw-caribbean/server` | 服务端（含 Web Dashboard） | shared, protocol |
| `@openclaw-caribbean/agent` | 客户端 Agent | shared, protocol |

## 快速发布

使用 `publish.sh` 一键发布：

```bash
./publish.sh 0.2.0
```

脚本会自动完成：
1. 更新所有包版本号
2. 将 `workspace:*` 临时替换为实际版本号
3. 按依赖顺序构建（shared → protocol → web → server → agent）
4. 将 web 构建产物复制到 server/dist/web
5. 按依赖顺序发布到 npm
6. 发布后将依赖恢复为 `workspace:*`

### 前提条件

- 已登录 npm：`npm whoami`
- 所有代码已提交（`--no-git-checks` 跳过 git 检查）
- `jq` 已安装（用于修改 package.json）

### 手动发布

如果需要单独发布某个包：

```bash
# 1. 更新版本号
cd packages/shared
jq '.version = "0.2.0"' package.json > tmp.json && mv tmp.json package.json

# 2. 构建
pnpm run build

# 3. 发布
pnpm publish --access public --no-git-checks
```

**必须按依赖顺序发布：** shared → protocol → server → agent

## 关键注意事项

### ES 模块要求

本项目使用 `"type": "module"`，所有包都是 ES 模块。在源码的 re-export 中必须包含 `.js` 扩展名：

```typescript
// ✅ 正确
export * from './node.js';
export * from './daemon.js';

// ❌ 错误 - Node.js ESM 不支持省略扩展名
export * from './node';
```

### workspace:* 依赖问题

本地开发使用 `workspace:*` 引用 workspace 内的包，但 npm 不支持此协议。发布前必须替换为实际版本号：

```json
// 本地开发 (workspace)
"@openclaw-caribbean/shared": "workspace:*"

// 发布时 (npm)
"@openclaw-caribbean/shared": "^0.2.0"
```

`publish.sh` 会自动处理替换和恢复。

### Web Dashboard 构建

Server 包包含 Web Dashboard 静态文件。发布时必须先构建 web 并复制到 server：

```bash
# 构建 web
cd apps/web && pnpm run build

# 复制到 server
mkdir -p apps/server/dist/web
cp -r apps/web/dist/* apps/server/dist/web/

# 构建 server
cd apps/server && pnpm run build
```

`publish.sh` 和 `build-all.sh` 都会自动完成此步骤。

### exports 字段

每个库包必须配置 `exports` 字段，否则 ES 模块导入会失败：

```json
{
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": "./dist/index.js"
}
```

### 包名 scope

所有包使用 `@openclaw-caribbean/` scope。scope 包必须在 `publishConfig` 中设置 `"access": "public"`：

```json
{
  "publishConfig": {
    "access": "public"
  }
}
```

## 本地构建（不发布）

```bash
# 构建所有包
./build-all.sh

# 或手动构建
pnpm --filter './packages/**' build
cd apps/server && pnpm run build:all
cd apps/agent && pnpm run build

# 本地启动
./start.sh
```

## 用户安装方式

```bash
# 安装 Server（含 Web UI）
npm install -g @openclaw-caribbean/server

# 初始化配置
caribbean-server init

# 启动服务
caribbean-server start

# 安装 Agent（在需要监控的节点上）
npm install -g @openclaw-caribbean/agent
caribbean-agent init --server ws://your-server:8080
caribbean-agent start
```

### 更新已安装的包

```bash
sudo npm install -g @openclaw-caribbean/server@latest @openclaw-caribbean/agent@latest
```

## 常见问题

### 安装报错 `EUNSUPPORTEDPROTOCOL: workspace:*`

发布的包中仍然包含 `workspace:*` 依赖。需要使用 `publish.sh` 重新发布，或手动替换依赖后发布。

### 安装报错 `ERR_MODULE_NOT_FOUND: Cannot find module '.../messages'`

源码中 re-export 缺少 `.js` 扩展名。确保所有 `.ts` 文件的相对导入都包含 `.js` 扩展名：

```typescript
export * from './messages.js';  // 不是 './messages'
```

### 安装报错 `ERR_UNSUPPORTED_DIR_IMPORT`

包的 `exports` 字段未正确配置。确保每个库包的 `package.json` 包含：

```json
{
  "exports": "./dist/index.js"
}
```

### 发布报错 `EOTP: This operation requires a one-time password`

npm 启用了两步验证。发布时需要在浏览器中完成 OTP 认证，或使用 automation token：

```bash
# 方法1：浏览器 OTP 认证（按提示操作）
pnpm publish --access public --no-git-checks

# 方法2：使用 automation token（CI 场景）
NPM_TOKEN=xxx pnpm publish --access public --no-git-checks
```

### 发布报错 `You cannot publish over the previously published versions`

版本号已存在。需要更新版本号后重新发布：

```bash
# 更新版本号
jq '.version = "0.2.1"' package.json > tmp.json && mv tmp.json package.json
```

### 如何测试包是否正常？

```bash
# 1. 下载并检查包内容
npm pack @openclaw-caribbean/server@latest
tar -xzf openclaw-caribbean-server-*.tgz
cat package/package.json

# 2. 在干净目录测试安装
mkdir /tmp/test && cd /tmp/test
npm init -y
npm install @openclaw-caribbean/server
node -e "import('@openclaw-caribbean/server').then(m => console.log('OK', Object.keys(m)))"
```

### 如何标记旧版本为废弃？

```bash
npm deprecate @openclaw-caribbean/server@0.1.0 "Use version 0.2.0 or later"
```

## 项目脚本说明

| 脚本 | 用途 |
|------|------|
| `./build-all.sh` | 本地构建所有包（shared → protocol → web → server → agent） |
| `./start.sh` | 构建 + 启动 server 和 agent（本地开发用） |
| `./publish.sh <version>` | 一键发布所有包到 npm |