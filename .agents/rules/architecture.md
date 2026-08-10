# 架构规则

## 分层

- 渲染进程承载 UI、交互状态、展示逻辑与唯一受控的本机 Agent 服务客户端。
- 主进程负责文件系统、窗口、系统集成、密钥访问、本地模型运行时和 Sidecar 生命周期；不得成为通用 HTTP 代理。
- preload 是 Renderer 与 Electron Main 之间唯一的跨进程桌面特权 Bridge；应暴露最小、具名、稳定且类型化的 API。
- 领域层应保持纯粹，可在 Node/Electron/浏览器适配层之外独立测试。
- 基础设施实现（HTTP、SSE、存储、模型 SDK）通过接口注入到领域或应用层。

## Renderer 本机服务边界

- 普通业务采用 `Renderer → FastAPI → Agent Runtime → Tool → ComfyUI Adapter`；`local-agent-client` 只是 Renderer 内部实现文件，非跨边界架构层。仅未来精确路径 `apps/desktop/src/renderer/lib/local-agent-client.ts` 可使用浏览器原生 `fetch` 与 `EventSource` 访问 `http://127.0.0.1:8765/v1/**`。
- 该例外只服务普通 Agent API、Run、Artifact 与标准 SSE；不得扩展为外部网络、其他 loopback 端口、网络客户端库、WebSocket、`XMLHttpRequest` 或 `sendBeacon` 权限。
- 桌面特权采用 `Renderer → Preload → Electron Main → OS / safeStorage / Sidecar`。文件选择、系统文件打开、密钥、安全存储、Sidecar 生命周期和其他系统权限必须走此路径。
- Bridge 是 Web UI 取得桌面特权的安全边界，不是 Renderer 调用 FastAPI 的必经层；禁止通用 HTTP 或 IPC 转发器。
- 本次不创建 `local-agent-client.ts`，不实现 HTTP API、CORS、CSP、自定义协议、Artifact 或 SSE；首个 API 功能前必须另行定义 URL、错误、取消与事件契约。

## IPC

- 不得把 `ipcRenderer`、`ipcMain` 或通用 invoke/send 能力直接暴露给渲染进程。
- 每个 channel 定义请求、响应、错误和取消语义，并在主进程边界验证参数。
- channel 名称按业务能力命名，禁止复用“万能”channel 传递任意命令。
- IPC 响应不得携带密钥、原始凭据、绝对隐私路径或未经脱敏的错误对象。
- 权限操作必须在主进程再次校验，不能仅依赖渲染进程的前置判断。

## 事件与流

- 流式模型响应仅使用 SSE 语义；不引入 NDJSON 或换行切分的 JSON 协议。
- 事件契约应集中定义，至少区分增量、完成、错误和取消。
- `local-agent-client` 将本机 SSE 解析为领域事件；UI 不直接依赖供应商事件格式。
- 取消、关闭窗口和卸载订阅时必须终止上游请求并释放资源。

## 依赖方向

- UI 可以依赖应用服务和共享类型，不能反向让领域逻辑依赖 UI。
- 领域层不能导入 Electron、React、浏览器 API、具体 HTTP 客户端或模型 SDK。
- 供应商特定代码留在 adapter/provider 目录，不能渗透到 UI 或领域规则。
- 共享类型只表达契约，不承载副作用或隐式运行时初始化。

## 变更准则

- 优先扩展既有边界，而不是跨层快捷调用。
- 新功能先确定数据所有者、调用方向、错误路径与取消路径。
- 若设计会增加公开 API、持久化格式或跨进程能力，先记录兼容性影响。
- 不以测试便利为由在生产模块增加测试专用导出、分支或目录。
