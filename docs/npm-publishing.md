# npm 发布指南

## 概述

Caribbean 使用 pnpm workspace + Changesets 进行多包管理和版本发布。

发布 4 个包到 npm：
- `@caribbean/shared` - 共享类型库
- `@caribbean/protocol` - WebSocket 消息协议
- `@caribbean/server` - 服务端 CLI 工具
- `@caribbean/agent` - 客户端 Agent

## 发布流程

### 首次发布（v0.1.0）

```bash
# 1. 安装 changeset 依赖
pnpm install

# 2. 构建所有包
pnpm build

# 3. 初始化 changeset（已完成）
# 已创建 .changeset/config.json 和初始 changeset

# 4. 应用版本变更
pnpm changeset version

# 5. 提交版本变更
git add .
git commit -m "chore: version packages to 0.1.0"

# 6. 发布到 npm
pnpm changeset publish

# 7. 推送 tag 到 GitHub
git push --follow-tags
```

### 后续版本更新

```bash
# 1. 创建新的 changeset
pnpm changeset

# 选择受影响的包和变更类型（patch/minor/major）
# 写入变更描述

# 2. 应用版本变更
pnpm changeset version

# 3. 提交代码和变更
git add .
git commit -m "feat: add new feature"

# 4. 发布到 npm
pnpm changeset publish

# 5. 推送 tag 到 GitHub
git push --follow-tags
```

## 包配置说明

### files 字段

每个包的 package.json 都配置了 `files` 字段，控制发布到 npm 的文件：

```json
{
  "files": ["dist"]
}
```

### publishConfig

```json
{
  "publishConfig": {
    "access": "public"
  }
}
```

### prepublishOnly 脚本

发布前自动构建：

```json
{
  "scripts": {
    "prepublishOnly": "pnpm run build"
  }
}
```

## Changesets 配置

配置文件：`.changeset/config.json`

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": ["@changesets/changelog-github", { "repo": "bitebyte/caribbean" }],
  "commit": false,
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch"
}
```

### 关键配置项说明

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `changelog` | `@changesets/changelog-github` | 使用 GitHub Releases 生成 changelog |
| `repo` | `bitebyte/caribbean` | GitHub 仓库路径 |
| `commit` | `false` | changeset 不自动创建 git commit（手动提交） |
| `access` | `public` | 公开发布（非 scoped 包不需要） |
| `updateInternalDependencies` | `patch` | workspace 包更新时自动 bump patch 版本 |
| `baseBranch` | `main` | 主分支 |

## 日常开发流程（不需要 npm 发布）

日常代码提交只需：

```bash
# 1. 修改代码
# 2. 提交到 git
git add .
git commit -m "feat: add some feature"
git push
```

**不需要**：
- ❌ 创建 changeset
- ❌ 更新版本号
- ❌ 发布到 npm

这些步骤只在准备发布新版本时才需要。

## 准备发布新版本时

```bash
# 1. 创建 changeset 描述变更
pnpm changeset

# 选择受影响的包：
#   @caribbean/shared (影响 protocol/server/agent)
#   @caribbean/protocol (影响 server/agent)
#   @caribbean/server
#   @caribbean/agent

# 2. 选择变更类型：
#   patch:  Bug 修复
#   minor: 新功能（向后兼容）
#   major: 破坏性变更

# 3. 写入变更描述
#   Examples:
#   "Fix WebSocket connection timeout issue"
#   "Add support for PostgreSQL database"
#   "Add settings page for authentication"

# 4. 应用版本变更
pnpm changeset version

# 5. 提交
git add .
git commit -m "chore: bump version to 0.2.0"

# 6. 发布
pnpm changeset publish

# 7. 推送
git push --follow-tags
```

## 用户安装方式

### 安装服务端

```bash
npm install -g @caribbean/server

# 初始化配置
caribbean-server init

# 启动服务
caribbean-server start
```

### 安装 Agent

```bash
npm install -g @caribbean/agent

# 初始化配置
caribbean-agent init --server ws://your-server:8080

# 启动 agent
caribbean-agent start
```

## 发布顺序

必须按依赖顺序发布：

1. **@caribbean/shared** - 无依赖
2. **@caribbean/protocol** - 依赖 shared
3. **@caribbean/server** - 依赖 protocol, shared
4. **@caribbean/agent** - 依赖 protocol, shared

Changesets 会自动处理顺序，但 `updateInternalDependencies: "patch"` 配置确保内部依赖更新。

## 常见问题

### Q: 如何撤销已发布的版本？

发布到 npm 的包无法删除或撤销。只能：

1. 发布新版本修复问题
2. 使用 `npm deprecate <package>@<version>` 标记为已废弃

```bash
npm deprecate @caribbean/server@0.1.0 "Use version 0.1.1 instead"
```

### Q: 发布失败怎么办？

检查以下几点：

1. npm 是否登录：`npm whoami`
2. npm scope 是否可访问：`npm view @caribbean/server`
3. 网络连接是否正常
4. 版本号是否已存在：`npm view @caribbean/server versions`

### Q: 如何测试包？

发布前可以本地测试：

```bash
# 打包（不发布）
npm pack --dry-run

# 查看打包内容
tar -tzf @caribbean-server-0.1.0.tgz

# 实际打包
npm pack

# 在其他目录测试
cd /tmp
npm install /path/to/@caribbean-server-0.1.0.tg
caribbean-server --version
```

## npm Org 管理

查看 org 状态：

```bash
# 查看成员
npm org ls @caribbean

# 添加成员
npm org add @caribbean <username>

# 设置为公开（如果是私有 scope）
npm access public @caribbean/server
```

## GitHub Actions 自动发布（可选）

创建 `.github/workflows/release.yml`：

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - run: pnpm install
      - run: pnpm build
      - run: echo "//registry.npmjs.org/:_authToken=${{ secrets.NPM_TOKEN }}" > .npmrc
      - run: pnpm changeset publish
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

需要在 GitHub 仓库设置中添加：
- `NPM_TOKEN`: npm 自动化 token
- `GITHUB_TOKEN`: GitHub PAT（用于创建 Release）

## 总结

- **日常开发**：只需 git commit，不需要 npm 发布
- **发布新版本**：创建 changeset → version → publish → push tags
- **自动依赖更新**：changeset 自动处理 workspace 包版本
- **版本策略**：遵循语义化版本（Semantic Versioning）

详细文档参考：
- [Changesets 官方文档](https://github.com/changesets/changesets)
- [pnpm changeset 配置](https://pnpm.io/package.json#changesets)
