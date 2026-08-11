# Museworks

Museworks 当前是一个可运行、可测试的本地优先桌面生图 Agent 工作区基线，还不是可真实生图的产品。当前桌面端提供用户明确选择的本地创作工作区、最近工作区记录，以及由 Mock CreativeRun 和 Mock Artifact 驱动的创作界面；FastAPI 服务仍只提供 `GET /v1/health` 健康契约。

## 当前可用能力

- Electron 43.2.0、React 19.2.4 和 TypeScript 5.9.3 桌面壳。
- 首次启动显示 Workspace Picker；用户只能通过系统原生目录选择器选择已有目录。
- `window.museworks.workspace` 只暴露加载最近工作区、选择本地目录和按工作区 id 激活最近项三项类型化能力。最近记录保存在 Electron `userData` 下的 JSON，不使用 SQLite。
- 三栏 Creative Workspace 支持 Empty、Generating、Complete 和 Error Mock 状态；当前不生成、保存或读取真实图片。
- `window.museworks.app.getInfo()` 保留为版本、平台和架构信息能力。
- Electron Main 固定启用 `contextIsolation` 与 `sandbox`，并关闭 `nodeIntegration`。
- FastAPI `/v1/health` 返回版本化的服务状态。
- pnpm/Turbo、ESLint、Prettier、Vitest、pytest 和 Renderer 边界扫描。
- Superpowers 主流程、项目级 Skill 路由、固定 SHA 的上游 Skill 清单和路由回归门禁。
- Electron Forge + Vite 是唯一桌面构建路径。项目源码、配置和直接依赖不使用 Webpack；Forge CLI 可能携带未使用的模板传递依赖。

当前没有 `/v1/run`、真实图像生成、Ark 调用、Deep Agents 运行时、ComfyUI 适配器、模型下载、密钥界面、Artifact 持久化或流式端点。

## 环境与安装

- Node.js `22.22.2`
- pnpm `10.33.2`
- Python `3.12`
- uv `0.11.32`：仍需预先安装；项目不会下载或升级 uv。WinGet、Scoop、CI 或自定义目录安装的 uv 优先从 `PATH` 解析；Windows 在 `PATH` 缺失时还会检查 `%USERPROFILE%\.local\bin\uv.exe`。

```powershell
corepack enable
corepack prepare pnpm@10.33.2 --activate
pnpm install --frozen-lockfile
uv sync --project apps/agent-service --group test --locked
```

## 运行与验证

主要开发入口：

```powershell
# Electron + FastAPI
pnpm dev

# FastAPI only
pnpm dev:server

# Electron only; does not start or wait for FastAPI
pnpm dev:desktop
```

`pnpm dev` 由 Turbo 并发启动 Electron Forge/Vite 与 Uvicorn/FastAPI；两个任务没有启动顺序或就绪等待。Electron Main 当前不等待、探测或管理 FastAPI。全栈联调固定使用 `http://127.0.0.1:8765/v1/health`，Turbo 不会向该任务传递 `MUSEWORKS_AGENT_PORT`。只有独立服务入口 `pnpm dev:server` 支持在启动前用 `MUSEWORKS_AGENT_PORT` 覆盖端口为 `1..65535` 的 ASCII 十进制值；该覆盖端口不承诺可被 Renderer 使用。对上述根命令按 Ctrl+C 是正常的开发关闭方式。

进入 Python workspace 的根 pnpm 命令会通过项目启动器解析 uv，不要求当前 shell 预先成功运行 `uv --version`。如果 `PATH` 和 Windows 官方默认目录都找不到 uv，命令会给出包含要求版本与官方安装文档的可操作错误。

这些命令只描述源码开发态。packaged Python sidecar 尚未实现，当前 Electron package 不包含或启动 Python 服务。

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

当前桌面特权调用链为：

```text
Renderer → Preload → Electron Main
```

目录选择和最近工作区元数据经上面的桌面特权通道处理；Renderer 不获得 fs、path、Node 或通用 IPC。`Workspace.rootPath` 仅会在用户明确选择目录、Main 规范化并确认其为目录后，经具名 Workspace IPC 返回给 Renderer。

FastAPI health 服务目前仍独立存在，Electron Main 不连接它。批准的未来方向分为两条受控通道：

```text
普通业务：Renderer → FastAPI → Agent Runtime → Tool → ComfyUI Adapter
桌面特权：Renderer → Preload → Electron Main → OS / safeStorage / Sidecar
```

首个业务 API 实现时才会创建 Renderer 内部的 `local-agent-client` 以集中封装请求；它不是额外的架构层。当前没有 Renderer 到 FastAPI 的调用、`/v1/run`、Artifact API、CORS、CSP `connect-src` 放宽或自定义协议。届时该专用文件才可访问固定本地地址 `http://127.0.0.1:8765/v1/**`，不得连接外部网络、任意 loopback 端口或 ComfyUI。文件选择、系统文件打开、密钥、安全存储、Sidecar 生命周期与其他桌面权限继续经 Preload/Main 的具名 IPC；Bridge 不是通用 HTTP 转发器。

未来 Ark Provider Adapter 计划使用 `Doubao-Seed-2.1-turbo` 与 `https://ark.cn-beijing.volces.com/api/plan/v3`。仓库未提交 API Key；后续密钥实现必须遵守 Electron Main 的受控存储边界。

未来流式响应只允许标准 SSE（`text/event-stream`），禁止 NDJSON、逐行 JSON 和自定义分隔协议；当前尚无任何流式端点。ComfyUI、本地模型与 Deep Agents 也均为后续能力。

RTX 3060 Ti 8GB VRAM 是未来本地模型运行时的设计约束，不是当前已执行的 GPU 功能或性能承诺。未来默认门禁为 `batch=1`、`768x768`、`preview=none` 与动态显存或 CPU offload；`1024x1024` 必须经目标硬件实机验证后才能启用。
