# 发布工作流程

本文档描述 Caribbean 项目使用 Changesets 进行版本管理和发布的标准流程。

## 概述

我们使用 [Changesets](https://github.com/changesets/changesets) 来管理版本号和发布，这样可以：

- ✅ 不需要手动修改 package.json 版本号
- ✅ 版本号变更基于实际的代码改动
- ✅ 自动生成 CHANGELOG
- ✅ 自动处理 workspace 内部依赖
- ✅ 与 git commit 完全解耦

## 工作流程

### 1. 开发阶段

完成功能开发后，创建一个 changeset 来记录变更：

```bash
pnpm changeset
```

你会被问到：
- **这是一个什么样的变更？**（patch/minor/major）
- **哪些包会受到影响？**
- **变更的摘要是什么？**

这会在 `.changeset/` 目录下创建一个 Markdown 文件，记录这次变更。

**示例：**
```bash
$ pnpm changeset

? Which packages would you like to include? › shared
? What kind of change is this for shared? › patch
? Please enter a summary for this change: › Fix node status type definition
```

### 2. 重复开发

继续开发和添加 changesets。你可以积累多个 changesets，在发布时一次性处理。

**查看待发布的 changesets：**
```bash
ls -la .changeset/*.md
```

### 3. 发布版本

当你准备好发布新版本时，运行：

```bash
./release.sh
```

这个脚本会自动：
1. 消费所有 changesets 文件并更新 package.json 版本号
2. 按 `shared → protocol → server → agent` 顺序构建所有包
3. 发布到 npm
4. 清理已消费的 changesets

**或者手动执行：**
```bash
pnpm changeset version    # 更新版本号
pnpm changeset publish    # 构建并发布
```

### 4. 提交变更

发布完成后，提交自动生成的变更：

```bash
git add .
git commit -m "chore: release X.Y.Z"
git push
```

## Changesets 配置

项目配置文件：`.changeset/config.json`

```json
{
  "changelog": "@changesets/cli",
  "commit": false,              // 不自动创建 git commit
  "access": "public",           // npm 包为 public
  "updateInternalDependencies": "patch",  // 内部依赖用 patch 更新
  "ignore": ["@openclaw-caribbean/web"]    // 忽略私有包
}
```

## 版本类型说明

| 类型 | 版本号变化 | 使用场景 |
|------|-----------|----------|
| **patch** | 0.0.X | Bug 修复，不影响 API |
| **minor** | 0.X.0 | 新功能，向后兼容 |
| **major** | X.0.0 | 破坏性变更，不向后兼容 |

## 常见问题

### Q: 如果我创建了一个 changeset 但还没有发布，可以取消吗？

A: 可以，直接删除对应的 `.changeset/*.md` 文件即可。

### Q: 我可以手动修改版本号吗？

A: 不建议。让 Changesets 根据 changesets 自动计算版本号，这样可以保持版本号和实际变更的一致性。

### Q: 发布失败了怎么办？

A: 检查 npm 登录状态和包名冲突。修复问题后重新运行 `pnpm changeset publish`。

### Q: 如何回滚一个已发布的版本？

A: npm 不支持删除已发布的版本。如果需要修复问题，发布一个新的 patch 版本。

## 旧脚本说明

原有的 `publish.sh` 脚本已弃用，请使用新的 `release.sh` 或 Changesets 工作流。

## 参考文档

- [Changesets 官方文档](https://github.com/changesets/changesets)
- [Monorepo 版本管理最佳实践](https://xn--zv9h8b.blogspot.com/2022/07/changesets-for-npm-packages.html)
