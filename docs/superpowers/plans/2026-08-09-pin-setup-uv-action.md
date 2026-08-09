# setup-uv CI 修复精简计划

**目标：** 修复 PR #1 在 Windows 和 macOS 上无法解析 `astral-sh/setup-uv@v9` 的启动失败。

- [x] 将 workflow 固定到官方 v9.0.0 不可变 commit SHA，并保留版本注释。
- [x] 更新 CI 契约测试，拒绝不存在的浮动 major tag。
- [x] 保持只读权限、原生双平台矩阵、uv 0.11.32 和其他 Action 版本不变。
- [x] 运行聚焦测试、全量根脚本测试、格式检查、Skill 验证和 `git diff --check`。
- [x] 完成一次独立只读审查；Git 操作仅在用户明确授权后执行。
