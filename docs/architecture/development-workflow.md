# 开发工作流

## 当前工程入口

当前可运行范围只有类型化 app-info 桌面壳与 FastAPI health 契约。安装、检查和打包使用：

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
uv run --project apps/agent-service --group test --locked pytest apps/agent-service/tests -q
pnpm --filter @museworks/desktop --fail-if-no-match start
pnpm --filter @museworks/desktop --fail-if-no-match package
```

Electron Forge + Vite 是唯一桌面构建路径，不添加 Webpack 源码、配置或直接依赖。Windows x64 的 GUI/package 已本地验证；macOS arm64 必须以 GitHub Actions 的原生 job 成功为准，目前未验证。

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
