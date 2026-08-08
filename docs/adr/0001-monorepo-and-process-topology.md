# ADR-0001：Monorepo 与进程拓扑

## 状态

已接受。

## 背景

桌面 UI、Electron 进程、本地智能体服务和工具适配层需要独立演进，同时必须保持受控的安全边界和可追踪的数据流。

## 决策

采用 Monorepo 管理 Electron + React + TypeScript 桌面端与 Python + FastAPI + Deep Agents 服务端代码。跨进程调用固定遵循：

```text
Renderer → Preload → Main → FastAPI → Agent Runtime → Tool → Adapter
```

Renderer 不直接使用 Node、系统权限或服务端凭据；Preload 仅导出白名单 API；第三方服务访问由 Adapter 统一承接。

## 后果

- 边界清晰，便于独立测试与替换外部服务。
- 跨层需求需要先定义契约，短期会增加协调成本。
- 不允许为便利绕过 Preload、Main 或 Adapter。
