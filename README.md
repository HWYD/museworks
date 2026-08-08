# Museworks

Museworks 当前是一个可运行、可测试的本地优先桌面生图 Agent 工程骨架，还不是可生图的产品。仓库目前只实现了两条最小能力：Electron/React 壳通过类型化 IPC 展示应用版本、平台和架构；FastAPI 服务提供 `GET /v1/health` 健康契约。

## 当前可用能力

- Electron 43.2.0、React 19.2.4 和 TypeScript 5.9.3 桌面壳。
- `window.museworks.app.getInfo()` 是 Renderer 唯一的 Bootstrap bridge。
- Electron Main 固定启用 `contextIsolation` 与 `sandbox`，并关闭 `nodeIntegration`。
- FastAPI `/v1/health` 返回版本化的服务状态。
- pnpm/Turbo、ESLint、Prettier、Vitest、pytest 和 Renderer 边界扫描。
- Superpowers 主流程、项目级 Skill 路由、固定 SHA 的上游 Skill 清单和路由回归门禁。
- Electron Forge + Vite 是唯一桌面构建路径。项目源码、配置和直接依赖不使用 Webpack；Forge CLI 可能携带未使用的模板传递依赖。

当前没有 `/v1/run`、图像生成、Ark 调用、Deep Agents 运行时、ComfyUI 适配器、模型下载、密钥界面或流式端点。

## 环境与安装

- Node.js `22.22.2`
- pnpm `10.33.2`
- Python `3.12`
- uv `0.11.32`

```powershell
corepack enable
corepack prepare pnpm@10.33.2 --activate
pnpm install --frozen-lockfile
uv sync --project apps/agent-service --group test --locked
```

## 运行与验证

启动桌面开发壳：

```powershell
pnpm --filter @museworks/desktop --fail-if-no-match start
```

运行完整本地检查：

```powershell
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm check
pnpm verify:boundaries
pnpm verify:skills
node --test scripts/*.test.mjs
uv run --project apps/agent-service --group test --locked pytest apps/agent-service/tests -q
```

## 开发 Skill 治理

Superpowers 是唯一开发流程主干。每个任务先由仓库内的 `museworks-best-practices-router` 按路径、意图和 Change Level 选择最小领域 Skill 集合；Electron 安全与打包由项目 Skill 固化，L2/L3 保留独立代码审查。外部 Skill 的固定来源、审核状态和项目覆盖规则见 `.agents/skills-manifest.yaml`，详细流程见 `docs/architecture/skill-governance.md`。

当前已启用的上游知识 Skill 是 React Best Practices、Composition Patterns、FastAPI、Turborepo 和 Python Testing Patterns。Web Design 候选因使用时隐式拉取浮动规则而隔离，pnpm 候选因混入 v11 且与当前 pnpm 10 配置冲突而拒绝，OpenAI Security 候选仍在隔离审查；它们不会被路由器加载。

生成本机 Electron package：

```powershell
pnpm --filter @museworks/desktop --fail-if-no-match package
node scripts/verify-packaged-asar.mjs
```

生成物位于 `apps/desktop/out`，不应提交到 Git。Windows x64 的开发窗口、package 和 `resources/app.asar` 已在本地验证；macOS arm64 仍须等待 GitHub Actions 的原生 `macos-15` job 实际成功，新增 workflow 本身不代表跨平台验证完成。

## 架构边界

当前桌面调用链止于：

```text
Renderer → Preload → Electron Main
```

FastAPI health 服务目前独立存在，Electron Main 尚未连接它。批准的未来完整方向是：

```text
Renderer → Preload → Electron Main → FastAPI → Agent Runtime → Tool → ComfyUI Adapter
```

未来 Ark Provider Adapter 计划使用 `Doubao-Seed-2.1-turbo` 与 `https://ark.cn-beijing.volces.com/api/plan/v3`。仓库未提交 API Key；后续密钥实现必须遵守 Electron Main 的受控存储边界。

未来流式响应只允许标准 SSE（`text/event-stream`），禁止 NDJSON、逐行 JSON 和自定义分隔协议；当前尚无任何流式端点。ComfyUI、本地模型与 Deep Agents 也均为后续能力。

RTX 3060 Ti 8GB VRAM 是未来本地模型运行时的设计约束，不是当前已执行的 GPU 功能或性能承诺。未来默认门禁为 `batch=1`、`768x768`、`preview=none` 与动态显存或 CPU offload；`1024x1024` 必须经目标硬件实机验证后才能启用。
