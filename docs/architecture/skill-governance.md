# Skill 治理

## 目标与边界

Museworks 使用“Superpowers 主流程 + 已审核上游领域知识 + 两个项目 Skill”。本治理只影响开发工作流，不改变 Electron、FastAPI、IPC、SSE、模型或 ComfyUI 运行时。

固定执行顺序是：

```text
using-superpowers
→ museworks-best-practices-router
→ 路由命中的领域 Skill
→ brainstorming / writing-plans
→ using-git-worktrees
→ test-driven-development
→ 领域验证
→ requesting-code-review
→ verification-before-completion
```

上游 Skill 只提供领域知识，不能成为第二套开发流程。冲突时依次采用用户决定、项目规则与 ADR、仓库精确版本、项目 Skill、上游 Skill。

## 项目 Skill

- `museworks-best-practices-router`：根据路径、意图与等级返回 required、optional、forbidden 和覆盖说明。它通过真实脚本输出进行回归测试。
- `museworks-electron-best-practices`：固化 Main/Preload/Renderer、窄 IPC、CSP、sandbox/context isolation、Forge + Vite、ASAR、Fuse、原生打包和 GUI smoke。

## 上游审核结果

所有候选在临时隔离目录中以固定 commit 获取，完整阅读 `SKILL.md`；启用候选还阅读了其直接引用材料。skills.sh 的公开扫描只作为线索，人工源码审核才决定状态。

| Skill                          | 状态        | 项目处理                                                                                                          |
| ------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------- |
| Vercel React Best Practices    | enabled     | 只用客户端渲染、重渲染、状态、包体和 JS 性能规则；禁用 Next.js、RSC、SSR、服务端规则与 Renderer 直连网络          |
| Vercel Composition Patterns    | enabled     | 仅公共组件 API、组合组件和布尔属性膨胀时使用                                                                      |
| Web Design Guidelines          | quarantined | 当前 Skill 要求每次从浮动 `main` 下载规则，违反固定 SHA 与禁止隐式联网                                            |
| FastAPI official               | enabled     | 受 FastAPI 0.116.x 可用 API 与 SSE-only 覆盖；禁用 JSON Lines/NDJSON、新版专属 API 和为规则升级框架               |
| Turborepo official             | enabled     | 只采用 Turbo 2.2.3 已验证的任务图、缓存和包边界原则；禁用 future flags、实验命令和新版专属配置                    |
| Python Testing Patterns        | enabled     | 只提供 pytest fixture、参数化、mock、异步和临时目录模式；Superpowers 继续拥有 RED/GREEN，禁止 skip/xfail 伪造绿色 |
| Antfu pnpm                     | rejected    | 候选混合 pnpm v11 配置模型，并错误否定本项目 pnpm 10 正在使用的 `.npmrc` 与 `package.json.pnpm`                   |
| OpenAI Security Best Practices | quarantined | 公开审计信号存在分歧且相关引用体量较大；完成逐引用审查前不进入活动路由                                            |

精确仓库、路径、commit SHA、触发范围、覆盖规则、审核人和复审日期以 `.agents/skills-manifest.yaml` 为唯一清单。

## 路由规则

- `apps/desktop/src/renderer/**`：React；用户可见 UI 使用项目 UI/可访问性规则，外部 Web Design 在解除隔离前不加载；公共组件 API 再加 Composition。
- `apps/desktop/src/main/**`、`src/preload/**`、Forge/Vite 配置：项目 Electron Skill；IPC、密钥、文件、网络或外部进程至少按 L2 处理。
- `apps/agent-service/**`：FastAPI + Python Testing；SSE、取消、并发和长任务生命周期需要 Async Python 领域知识，但候选在完成固定 SHA 审计并写入 manifest 前保持 forbidden，只输出待审核说明。
- `package.json`、workspace、Turbo、锁文件：Turborepo；保留 pnpm 10.33.2、Turbo 2.2.3、hoisted Forge 布局和 frozen lockfile，拒绝当前 pnpm 候选。
- Vitest/pytest 测试：始终由 Superpowers TDD 保证 RED → GREEN；pytest 可加载 Python Testing，Vitest 不加载第三方通用工作流。
- `.github/workflows/**`：保留只读权限、禁止发布、Windows x64 与 macOS arm64 原生矩阵。CI 专用 Skill 在完成固定 SHA 审计并加入 manifest 前保持 forbidden。

## 更新与安装

启用外部 Skill 安装在 Codex 全局 Skill 目录，项目路由、覆盖和审计留在仓库。更新时：发现版本 → 临时目录隔离 → 完整阅读 Skill 及直接引用 → 运行路由回归 → 独立审查 → 更新 manifest SHA 与日期 → 替换活动安装。禁止跟随浮动分支、自动执行候选脚本、读取秘密或隐式联网。

本仓库的自动门禁是：

```powershell
pnpm verify:skills
node --test scripts/skill-governance.test.mjs
```

前者验证 manifest 结构、固定 SHA、审核字段、隔离状态和两个项目 Skill 文件；后者覆盖 Renderer、IPC、SSE、pnpm/Turbo、测试、L2/L3 和不适用建议七类路由场景。
