# ADR-0004：Renderer 本机 Agent 服务边界

## 状态

已接受。

## 背景

Museworks 的 Renderer 未来需要消费本机 Agent 的普通业务 API、Artifact 数据和标准 SSE。若这些请求都经由 Preload 与 Electron Main 转发，桌面特权 Bridge 会退化为通用 HTTP 代理，扩大 IPC 表面积并混淆权限边界。

文件选择、系统文件打开、密钥、安全存储和 Python Sidecar 生命周期则属于桌面特权，仍必须由受控 Electron Bridge 管理。

ADR-0001 与 ADR-0002 已增加本 ADR 的交叉引用；本 ADR 限定其中“业务 HTTP/SSE 必经 Preload/Electron Main”的旧解释。Renderer ↔ Main 的桌面特权 IPC 仍必须经 Preload。历史 `docs/superpowers` 规格和计划保留原样，不回写。

## 决策

采用双通道架构：

```text
普通业务：Renderer → FastAPI → Agent Runtime → Tool → ComfyUI Adapter
桌面特权：Renderer → Preload → Electron Main → OS / safeStorage / Sidecar
```

- 普通 Agent API、Run、Artifact 和标准 SSE 由 Renderer 直连 `http://127.0.0.1:8765/v1/**`；未来唯一的 `apps/desktop/src/renderer/lib/local-agent-client.ts` 只负责在 Renderer 内部集中封装该请求，不构成独立架构层，且只可使用浏览器原生 `fetch` 与 `EventSource`。
- Bridge 是 Web UI 获取桌面特权能力的安全边界，不是 Renderer 访问本机服务的必经层，且不得提供通用 HTTP 或 IPC 转发能力。
- Renderer 仍不得访问 Node、环境变量、密钥、文件、ComfyUI、外部网络或任意其他 loopback 端口。网络客户端库、WebSocket、`XMLHttpRequest` 和 `sendBeacon` 不是允许的旁路。
- Artifact 业务数据经 FastAPI 返回；选择路径、打开系统文件和其他 OS 操作继续经过 Preload → Main。

本次只建立治理规则、静态边界门禁和开发端口职责；不创建 `local-agent-client.ts`，不新增 HTTP API、Artifact、SSE、CORS、CSP、自定义协议或模型功能。

## 首个 API 功能前置条件

在首次实现 Renderer → FastAPI API 前，必须先完成独立设计、契约测试和以下安全配置：

- 打包 Renderer 使用固定安全协议 `museworks://app`；开发态 origin 固定为 `http://127.0.0.1:5173`，不继续使用 `file://`。
- CSP 仅新增 `connect-src http://127.0.0.1:8765`，不放宽 `script-src`、sandbox、context isolation 或 Node 集成。
- FastAPI CORS 仅允许上述两个精确 origin；不得使用 `*` 或凭据，方法和 headers 按已定义 API 契约最小化。
- `/v1/run` 只可使用标准 SSE（`text/event-stream`），并在实现前定义和测试增量、完成、错误与取消事件；禁止 NDJSON、WebSocket 和以连接关闭表示完成。
- `local-agent-client` 必须先定义 URL、错误、取消与 SSE 事件契约，并覆盖调用方行为。

## 后果

- 普通本机服务数据不再为了桌面特权而经过 IPC；桌面权限与业务 HTTP 的审核责任更清晰。
- Renderer 的唯一网络例外必须保持精确路径、精确 loopback 地址和原生浏览器 API，不能扩展为一般网络权限。
- 当前 `/v1/health`、`window.museworks.app.getInfo()` 与 `/v1/run` 的 404 行为不变；后续 API 实现仍需单独批准。

## 恢复

本阶段不迁移用户数据、密钥、服务端口或发布产物。若治理规则或静态门禁出现问题，恢复本 ADR 对应的规则与配置即可回到此前单通道路由；不得以放宽 Renderer 或 Electron 隔离作为临时修复。
