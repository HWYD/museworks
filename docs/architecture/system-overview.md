# 系统概览

## 当前实现

Museworks 当前是桌面端 AI 创作工程骨架，不是已具备生图能力的产品。

- Electron/React 壳通过 `Renderer → Preload → Electron Main` 的类型化 IPC 读取并展示应用版本、平台和架构。
- FastAPI 服务独立提供 `GET /v1/health`，Electron Main 尚未连接该服务。
- 桌面端只使用 Electron Forge + Vite 构建。源码、配置和直接依赖不使用 Webpack；Forge CLI 自身可能包含未使用的模板传递依赖。
- 当前没有 `/v1/run`、生成、Ark、Deep Agents、ComfyUI、本地模型、密钥管理或流式实现。

## 当前开发拓扑

```text
pnpm dev → Turbo → Electron Forge/Vite
                 ↘ Uvicorn/FastAPI
```

Turbo 并发持有这两个源码开发进程，不设置启动顺序或 health 等待。Electron Main 不启动、停止、探测或管理 FastAPI，也没有调用当前 health 端点。全栈 `pnpm dev` 固定让服务监听 `127.0.0.1:8765`，且不向该任务传递 `MUSEWORKS_AGENT_PORT`；独立入口是 `pnpm dev:desktop` 与 `pnpm dev:server`，只有后者允许用该变量覆盖端口，覆盖端口不承诺可被 Renderer 使用。

该拓扑不代表打包集成：packaged Python sidecar 尚未实现，当前 Electron package 不包含 Python 服务。

## 批准的未来拓扑

后续能力采用双通道受控边界：

```text
普通业务：Renderer → FastAPI → Agent Runtime → Tool → ComfyUI Adapter
桌面特权：Renderer → Preload → Electron Main → OS / safeStorage / Sidecar
```

- Renderer 仅负责界面状态和用户交互，不直接访问 Node、文件、环境变量、密钥、ComfyUI、外部网络或任意 loopback 端口。首个普通 API 实现时，唯一的 `local-agent-client` 可访问固定的 `http://127.0.0.1:8765/v1/**`。
- Preload 只暴露最小、具名、类型化的桌面权限 IPC API，不能成为通用 HTTP 转发器。
- Electron Main 管理桌面权限、IPC、安全存储和未来 Sidecar 生命周期；未来打包 sidecar 的本地服务生命周期仍需单独实现。
- FastAPI 是未来本地 HTTP 契约边界；普通 Agent、Run、Artifact 与标准 SSE 业务数据由 Renderer 直连，未来可由 Renderer 内部的 `local-agent-client` 集中封装请求，Agent Runtime 负责 Deep Agents 编排。
- Ark 是 Agent Runtime 调用的模型 Provider Adapter；Tool 通过 ComfyUI Adapter 调用托管或外部 ComfyUI。

当前尚未创建 `local-agent-client`，也没有普通业务 API、Artifact、SSE、CORS、CSP `connect-src` 或 `museworks://app` 自定义协议实现。首次 API 功能必须先收紧实现：开发态仅允许固定 Vite origin，打包态使用 `museworks://app`；FastAPI CORS 只允许这两个固定 origin，不使用 `*` 或凭据；CSP 只增加 `connect-src http://127.0.0.1:8765`；SSE 保持 `text/event-stream`，并显式定义增量、完成、错误与取消事件。

未来 Ark 接入计划使用模型 `Doubao-Seed-2.1-turbo` 和基础地址 `https://ark.cn-beijing.volces.com/api/plan/v3`。仓库未提交 API Key；后续凭据只可由 Electron Main 在安全边界内管理，不得进入 Renderer、Preload、日志或测试夹具。

## 流式通信约束

未来流式响应只允许标准 SSE（`text/event-stream`）。禁止 NDJSON、逐行 JSON、自定义分隔符或依赖断连表示完成。当前没有流式端点；增量、完成、错误和取消事件必须在实现前单独定义并测试。

## 资源基线

RTX 3060 Ti 8GB VRAM（显存）是未来本地模型运行时的开发参考约束，不是当前已执行的 GPU 功能或性能承诺。未来默认门禁为 `batch=1`、`768x768`、`preview=none`，并采用动态显存或 CPU offload；`1024x1024` 仅可在该目标硬件实机门禁通过后启用。系统内存另行探测和记录，不能由 8GB VRAM 推导。

## 验证状态

Windows x64 的 Electron Forge + Vite 开发窗口、package 和 ASAR 已在本地验证。GitHub Actions 定义了 `windows-2025` x64 与 `macos-15` arm64 原生矩阵，但本任务不推送或触发外部 CI；macOS arm64 在对应 job 实际成功前保持未验证状态。
