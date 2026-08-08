# 系统概览

## 目标

Museworks 是一个桌面端 AI 创作工程骨架，统一承载对话式智能体、工作流工具和图像生成能力。当前文档仅定义系统边界与通信拓扑，不代表功能已经实现。

## 技术边界

- 桌面端：Electron、React、TypeScript。
- 智能体服务：Python、FastAPI、Deep Agents。
- 图像工作流：ComfyUI。
- 模型与推理服务：Ark。

## 进程与通道

所有请求遵循单向的受控边界：

```text
Renderer → Preload → Electron Main → FastAPI → Agent Runtime → Tool → ComfyUI Adapter
```

- Renderer 仅负责界面状态和用户交互，不直接访问系统能力或后端服务。
- Preload 暴露经过白名单约束的 IPC API。
- Electron Main 管理 Electron 生命周期、IPC 编排和本地服务连接。
- FastAPI 提供本地 HTTP 与流式接口，并将任务交给 Agent Runtime。
- Agent Runtime 负责 Deep Agents 的编排；Ark 是 Agent Runtime 调用的模型 Provider Adapter；Tool 表达可调用能力并调用 ComfyUI Adapter。

## 流式通信约束

前后端流式响应统一使用 SSE（`text/event-stream`）。禁止以 NDJSON 作为流式协议，也不允许客户端按换行符自行推断事件边界。事件名称、负载结构与错误语义将在实现前单独固化为契约。

## 资源基线

开发参考硬件为 RTX 3060 Ti 8GB VRAM（显存），优先使用远端 Ark 推理与按需调用的 ComfyUI 能力。默认未来生成基线为 `batch=1`、`768x768`、`preview=none`，并采用动态显存或 CPU offload；`1024x1024` 仅可在该目标硬件实机门禁通过后启用。系统内存另行探测和记录，不能由 8GB VRAM 推导。

## 非目标

- 不在 Renderer 中嵌入模型密钥、服务地址或工具执行逻辑。
- 不把 ComfyUI 或 Ark 的协议细节暴露给 UI。
- 不将 SSE 与 NDJSON 混用为同一条业务流的传输方式。
