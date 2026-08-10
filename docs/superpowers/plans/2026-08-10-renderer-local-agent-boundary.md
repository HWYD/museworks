# Renderer 直连本地 FastAPI 边界（L2 精简计划）

## 目标

为未来 Renderer 直连本地 Agent API 建立受限双通道：普通业务由 Renderer 访问固定本机 FastAPI；`local-agent-client` 仅是 Renderer 内部的集中封装文件。文件、密钥、系统资源和 Sidecar 等桌面特权仍经由 Preload → Main。

## 接口变化

- 未来仅 `apps/desktop/src/renderer/lib/local-agent-client.ts` 可用浏览器原生 `fetch`/`EventSource` 访问静态 `http://127.0.0.1:8765/v1/**` URL；本阶段不创建该文件或任何 API。
- `pnpm dev` 保持 Turbo 全栈启动并固定服务默认端口；`pnpm dev:server` 改为 `dev:standalone`，只有该任务接收 `MUSEWORKS_AGENT_PORT`。
- Bridge 只承载具名桌面特权能力，禁止退化为通用 HTTP/IPC 代理。

## 实现分组

1. 以 ADR-0004 和项目规则同步双通道边界、未来 CORS/CSP/自定义协议/SSE 前置条件，以及与 ADR-0001/0002 的关系。
2. 通过 TypeScript AST 扫描器拒绝普通 Renderer 网络访问；允许路径必须同时满足精确仓库路径、原生 API 和静态本机 `/v1` URL，并覆盖常见别名、计算属性和动态导入旁路。
3. 用 workspace 契约测试和当前文档明确 Turbo 端口变量的独立服务作用域；不改 FastAPI、Electron 或锁文件。

## 验证与假设

- 运行边界/Router/workspace 配置测试、`pnpm verify:boundaries`、`pnpm verify:skills`、格式检查和 `git diff --check`。
- 仅做一次最终独立审查；不创建 SDD task brief/report。
- 本阶段没有 `/v1/run`、Artifact、SSE、CORS、CSP、自定义协议、模型功能或 Electron 安全设置变更。
- 所有变更保留未暂存 diff；不执行提交、推送或合并。
