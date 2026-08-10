# 提交前校验精简计划

## 目标

为已获明确授权的 Museworks 提交提供快速、跨平台且只读取 Git index 的本地校验；不改变桌面端、FastAPI、Turbo 任务图或 CI 权限。

## 接口变化

- 根命令新增 `pnpm verify:commit` 与 `prepare`。
- Git hooks 新增 `.husky/pre-commit` 和 `.husky/commit-msg`。
- `pre-commit` 先运行 lint-staged，再运行 index 精确校验；`commit-msg` 使用 Conventional Commit。

## 实现分组

1. 固定 Husky、lint-staged 和 commitlint 版本，声明格式化规则与 Conventional Commit 配置。
2. 复用现有 Renderer AST 和 Skill 治理校验，实现对暂存 index 内容的边界检查。
3. 更新开发流程和 Git 授权说明，明确 hook 不构成提交、推送或合并授权。

## 测试与假设

- 用临时 Git 仓库验证暂存 Renderer、Skill manifest、空白错误与工作区内容不一致时仍按 index 失败。
- 用真实 commitlint CLI 验证合法和非法提交消息。
- 验证 Hook 配置、格式、Skill 治理与 diff；完整 package/ASAR 留在 CI。
- 假设 Python 继续仅由现有测试和 CI 校验，不在 lint-staged 中引入新的格式化工具。
