# 开发工作流

## 当前工程入口

当前可运行范围只有类型化 app-info 桌面壳与 FastAPI health 契约。任何会进入 Python workspace 的根命令运行前，`uv --version` 必须能从 `PATH` 解析并显示 `uv 0.11.32`。

从仓库根目录启动：

```powershell
# Electron + FastAPI
pnpm dev

# FastAPI only
pnpm dev:agent

# Electron only; does not start or wait for FastAPI
pnpm dev:desktop
```

`pnpm dev` 通过 Turbo 并发持有 Electron Forge/Vite 与 Uvicorn/FastAPI 两个长运行任务，不设置启动顺序或就绪等待。Electron Main 不等待、探测或管理 FastAPI。默认 health 地址是 `http://127.0.0.1:8765/v1/health`；`MUSEWORKS_AGENT_PORT` 可将端口覆盖为 `1..65535` 的 ASCII 十进制值。按 Ctrl+C 是这些根开发命令的正常关闭方式。

安装、检查和打包使用：

```powershell
corepack prepare pnpm@10.33.2 --activate
pnpm install --frozen-lockfile
uv sync --project apps/agent-service --group test --locked
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm check
pnpm verify:boundaries
pnpm verify:skills
pnpm --filter @museworks/desktop --fail-if-no-match package
node scripts/verify-packaged-asar.mjs
```

`pnpm test` 通过 `@museworks/agent-service` workspace 桥接执行 locked pytest；`pnpm check` 也通过同一桥接执行 Python tests 和 `uv lock --check`。直接运行下面的 uv 命令适合聚焦排查 Python 测试或锁文件问题，不是第二套必需的完整仓库检查路径：

```powershell
uv run --project apps/agent-service --group test --locked pytest apps/agent-service/tests -q
uv lock --project apps/agent-service --check
```

Electron Forge + Vite 是唯一桌面构建路径，不添加 Webpack 源码、配置或直接依赖。当前 package 不包含或启动 Python 服务；packaged Python sidecar 尚未实现。Windows x64 的 GUI/package 已本地验证；macOS arm64 必须以 GitHub Actions 的原生 job 成功为准，目前未验证。

## Skill 路由

Superpowers 是唯一开发流程主干。每个任务在 `using-superpowers` 后使用 `museworks-best-practices-router`，输入变更路径、意图和 L0-L3 等级，只加载返回的 required Skill；optional 只在对应条件成立时加载，forbidden 不得加载。

```powershell
node .agents/skills/museworks-best-practices-router/scripts/route-skills.mjs --level L2 --intent "SSE cancellation" apps/agent-service/src/museworks_agent/routes/run.py
```

项目约束和锁定版本始终覆盖上游通用建议。L2/L3 在实现证据就绪后进入独立代码审查；L3 必须先批准设计和实施计划。完整来源、状态与更新流程见 `skill-governance.md` 和 `.agents/skills-manifest.yaml`。

## 变更原则

每项功能先确定其所属边界，再实施最小改动：UI 属于 Renderer，受控桌面能力属于 Preload/Electron Main，服务与编排属于 FastAPI/Agent Runtime，Ark 模型差异属于 Provider Adapter，ComfyUI 差异属于 Tool 后的 ComfyUI Adapter。

当前 Renderer 不直接访问 FastAPI；FastAPI 也只有 `/v1/health`。`/v1/run`、生成、Ark、Deep Agents、ComfyUI、本地模型和流式链路都属于后续工作。

## 后续功能流程

1. 明确用户场景、输入输出和资源约束。
2. 定义跨边界契约：IPC 方法、HTTP 请求、SSE 事件或工具参数。
3. 自内向外实现 Ark Provider Adapter、ComfyUI Adapter 与 Tool，再实现 Agent Runtime、FastAPI、Electron Main/Preload 和 Renderer。
4. 为新增边界补充最小自动化测试：契约、错误路径和流式结束路径。
5. 在目标资源基线上验证，记录实测限制，不以未验证的性能作承诺。

## 协议要求

- Renderer 只能通过 Preload 提供的 API 访问 Main。
- 未来 Main 与 FastAPI 的流式数据保持标准 SSE（`text/event-stream`）语义直到消费边界；当前没有流式端点。
- SSE 事件必须有显式事件类型和结构化数据；错误与完成也必须是事件，禁止依赖断流、NDJSON、逐行 JSON 或自定义分隔符推断。
- Agent Runtime 通过模型 Provider Adapter 调用 Ark，并通过 Tool 调用 ComfyUI Adapter，不直接依赖两者的具体协议。
- Ark 计划使用 `Doubao-Seed-2.1-turbo` 与 `https://ark.cn-beijing.volces.com/api/plan/v3`，但当前没有调用实现，也没有提交 API Key。

## 本地资源验证

RTX 3060 Ti 8GB VRAM（显存）是开发参考门禁而非性能保证。任何涉及生成分辨率、并发或常驻模型的变更，都必须在目标配置上分别测量 GPU 峰值显存、系统内存、失败模式和恢复路径；未通过实机门禁前不得声称稳定支持 `1024x1024`。

该门禁只约束未来本地模型实现；当前 Bootstrap 不执行 GPU 推理、模型下载或 ComfyUI 工作流。
