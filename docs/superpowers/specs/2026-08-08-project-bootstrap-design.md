# Museworks 工程骨架设计

**日期：** 2026-08-08
**状态：** 已批准
**范围：** Bootstrap Task 0 的工程治理基线；本轮不实现产品功能。

## 目标

建立一个可审计、可分阶段实施的本地优先桌面生图 Agent 工程入口。首批后续实现者应能从仓库规则、架构说明、ADR 和计划中得到一致的边界，而不需要猜测运行时拓扑或安全策略。

## 已批准的架构事实

Museworks 面向 Windows 和 macOS，是本地优先的桌面生图 Agent。目标技术组合为 Electron、React、TypeScript、Python、FastAPI、Deep Agents、ComfyUI，以及豆包 Plan API（Ark）。

运行时单向调用链固定为：

```text
Renderer → Preload → Electron Main → FastAPI → Agent Runtime → Tool → ComfyUI Adapter
```

Renderer 不得直接使用 Node、环境变量、文件系统、网络凭据或 ComfyUI。Preload 以最小、类型化的 API 作为唯一桥梁；Electron Main 负责受控进程与 IPC 边界；Python 服务仅通过明确的 HTTP 契约暴露能力。

外部流式响应仅可使用标准 SSE（`text/event-stream`），禁止以 NDJSON、逐行 JSON 或自定义分隔符替代。该规则为未来 run 链路的协议约束，不在本轮提前实现。

## 本轮交付

- 根目录治理路由和细化规则，覆盖层级、安全、测试、模型运行时与验证方式。
- 架构概览、开发工作流和三份 ADR，固化单仓库/进程拓扑、SSE 与 IPC 边界、本地模型运行时策略。
- 一份可执行的后续工程实施计划，明确四个顺序任务、接口、版本和 TDD 验证命令。
- `.gitignore` 和忽略的 Bootstrap 记录，避免本地运行时、模型、构建物、凭据及 Agent 临时状态进入版本库。

## 边界与安全决策

所有密钥仅由主进程或 Python 服务从受控环境读取；不得通过 renderer、preload API、日志、错误对象或提交文件泄露。IPC 采用显式 allowlist 和输入校验，禁止通用 `invoke(channel, payload)` 代理。Electron 必须保持 `contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`。

开发参考硬件为 RTX 3060 Ti 8GB。FLUX.2 Klein 4B distilled 官方约需 8.4GB，未来默认基线为 `batch=1`、`768x768`、关闭 preview、动态显存/CPU offload。`1024x1024` 只能经目标硬件实机门禁后启用；文档和代码均不得在未验证前宣称其可在 8GB 上稳定运行。

## 非目标

本轮明确不包含：

- 真实 Ark/豆包 Plan API 调用；
- Deep Agents 运行时、工具编排或状态持久化；
- ComfyUI 安装、适配器、工作流或模型下载；
- SSE run 链路、事件协议或前端消费实现；
- Electron/Forge 实际打包、代码签名、自动更新或发布；
- 任何产品页面、生成能力、依赖安装或产品代码。

## 后续实施顺序

后续工程应按计划的四个独立可验证任务推进：先建立 pnpm/Turbo 工作区及边界校验，再实现最小的 contracts 与安全 Electron/React 壳，随后新增 `uv`/FastAPI health 服务，最后补 CI、文档与全量验证。每个任务必须在其自身的 red/green 循环与独立审查通过后再进入下一个任务。

## 自审

本文没有待定项；所述接口、版本和运行时限制均与后续计划一致。范围刻意止于工程治理和实施说明，未提前承诺未验证的模型性能或任何真实外部服务行为。
