# 系统概览

## 当前实现

Museworks 当前是桌面端 AI 创作工程骨架，不是已具备生图能力的产品。

- Electron/React 壳通过 `Renderer → Preload → Electron Main` 的类型化 IPC 读取并展示应用版本、平台和架构。
- FastAPI 服务独立提供 `GET /v1/health`，Electron Main 尚未连接该服务。
- 桌面端只使用 Electron Forge + Vite 构建。源码、配置和直接依赖不使用 Webpack；Forge CLI 自身可能包含未使用的模板传递依赖。
- 当前没有 `/v1/run`、生成、Ark、Deep Agents、ComfyUI、本地模型、密钥管理或流式实现。

## 批准的未来拓扑

后续能力必须沿单向受控边界扩展：

```text
Renderer → Preload → Electron Main → FastAPI → Agent Runtime → Tool → ComfyUI Adapter
```

- Renderer 仅负责界面状态和用户交互，不直接访问 Node、文件、环境变量、密钥、ComfyUI 或后端 HTTP。
- Preload 只暴露最小、具名、类型化的 IPC API。
- Electron Main 管理桌面权限、IPC、本地服务生命周期和受控网络边界。
- FastAPI 是未来本地 HTTP 契约边界；Agent Runtime 负责 Deep Agents 编排。
- Ark 是 Agent Runtime 调用的模型 Provider Adapter；Tool 通过 ComfyUI Adapter 调用托管或外部 ComfyUI。

未来 Ark 接入计划使用模型 `Doubao-Seed-2.1-turbo` 和基础地址 `https://ark.cn-beijing.volces.com/api/plan/v3`。仓库未提交 API Key；后续凭据只可由 Electron Main 在安全边界内管理，不得进入 Renderer、Preload、日志或测试夹具。

## 流式通信约束

未来流式响应只允许标准 SSE（`text/event-stream`）。禁止 NDJSON、逐行 JSON、自定义分隔符或依赖断连表示完成。当前没有流式端点；增量、完成、错误和取消事件必须在实现前单独定义并测试。

## 资源基线

RTX 3060 Ti 8GB VRAM（显存）是未来本地模型运行时的开发参考约束，不是当前已执行的 GPU 功能或性能承诺。未来默认门禁为 `batch=1`、`768x768`、`preview=none`，并采用动态显存或 CPU offload；`1024x1024` 仅可在该目标硬件实机门禁通过后启用。系统内存另行探测和记录，不能由 8GB VRAM 推导。

## 验证状态

Windows x64 的 Electron Forge + Vite 开发窗口、package 和 ASAR 已在本地验证。GitHub Actions 定义了 `windows-2025` x64 与 `macos-15` arm64 原生矩阵，但本任务不推送或触发外部 CI；macOS arm64 在对应 job 实际成功前保持未验证状态。
