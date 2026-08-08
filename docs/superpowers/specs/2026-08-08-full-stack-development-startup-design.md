# Museworks 全栈开发启动设计

**日期：** 2026-08-08
**状态：** 已批准
**变更等级：** L2（本地 HTTP 服务与跨运行时开发编排）

## 背景

当前 Electron Forge + Vite 桌面壳可以独立启动，FastAPI 也已经提供 `GET /v1/health` 契约，但 Python 服务只有可导入的 `app` 对象，没有可执行入口。根目录没有一条命令同时启动桌面端和后端，Python 服务也没有进入 pnpm/Turbo 的任务图。

本阶段补齐源码开发环境的完整启动路径。用户已明确决定：Turbo 同时启动 Electron 与 FastAPI，Electron Main 不等待 health、不处理两个开发任务之间的启动竞态。

## 目标

- `pnpm dev` 从仓库根目录同时启动 Electron Forge + Vite 与 FastAPI/Uvicorn。
- `pnpm dev:agent` 可独立启动 FastAPI；`pnpm dev:desktop` 可独立启动 Electron。
- Python 服务具有直接、可测试的模块或 console-script 启动入口。
- Python 服务通过一个最小 pnpm workspace 桥接清单进入 Turbo 的 `dev`、`test` 和适用的工程任务。
- Turbo 负责开发进程编排、日志前缀和终止信号传播；不新增另一套并发启动器。
- 保持现有 Renderer → Preload → Electron Main → FastAPI 分层与安全边界。
- 在设计中固定未来 Electron Main sidecar 生命周期接口的职责，但本阶段不加入未使用的生产接口或空实现。

## 非目标

- 不让 Electron Main spawn、kill、探测或等待 Python 进程。
- 不保证 Electron 窗口创建前 FastAPI 已经 ready。
- 不实现打包后的 Python sidecar、PyInstaller、签名或升级机制。
- 不新增 Renderer 到 FastAPI 的直接 HTTP 调用，也不新增相关 IPC。
- 不实现 `/v1/run`、SSE、Ark、Deep Agents、ComfyUI 或本地模型能力。
- 不借此任务升级 Node、pnpm、Turbo、Electron、Forge、Vite、FastAPI 或其他既有工具链。
- 不为扩大工程治理范围而额外引入 Python lint/typecheck 工具。

## 方案选择

采用 Turbo 原生持久任务并行编排：

```text
pnpm dev
└── turbo run dev
    ├── @museworks/agent-service#dev → uv/Uvicorn/FastAPI
    └── @museworks/desktop#dev       → Electron Forge/Vite
```

不使用根级 Node `spawn` 脚本或第三方 concurrently 工具，因为它们会与 Turbo 重复承担进程编排职责。也不由 Electron Main 启动开发服务，因为本阶段要求 Turbo 同时持有两个开发任务。

Turbo 任务不设置先后依赖。当前 UI 尚不消费 FastAPI，因此允许 Electron 先显示窗口；后续真正接入 Main → FastAPI 调用时，再为具体调用设计明确的连接、失败和重试语义，不能把本阶段的并行启动误当作服务就绪保证。

## Workspace 与命令

在 `apps/agent-service/package.json` 添加只承载任务桥接的私有 workspace 包，名称固定为 `@museworks/agent-service`。它不承载 Node 运行时依赖，也不改变 Python 包的事实来源；Python 依赖仍由 `pyproject.toml` 与 `uv.lock` 管理。

根目录提供：

| 命令               | 行为                                                        |
| ------------------ | ----------------------------------------------------------- |
| `pnpm dev`         | 通过 Turbo 同时启动 desktop 与 agent-service 的持久开发任务 |
| `pnpm dev:agent`   | 通过 Turbo filter 只启动 Python 服务                        |
| `pnpm dev:desktop` | 通过 Turbo filter 只启动 Electron                           |

桌面包增加 `dev` 脚本并保留现有 `start` 兼容入口。Python 桥接包至少提供 `dev`、`start`、`test` 和与当前工程真实产物相符的任务；不得伪造 lint/typecheck 通过。

`turbo.json` 的 `dev` 任务使用：

- `cache: false`：开发服务器不缓存。
- `persistent: true`：两个服务都是长运行任务。
- 不使用会绕开任务图的 `--parallel`。
- 只声明该任务确实使用的环境变量。

## Python 服务入口

FastAPI 增加 Uvicorn 运行时依赖和显式 Python 入口。入口负责：

- 加载现有 `museworks_agent.main:app`，不复制 FastAPI app。
- 只监听 `127.0.0.1`，不开放局域网地址。
- 使用固定的安全默认端口；如允许端口环境变量，只接受 `1..65535` 的十进制整数并在错误时快速失败。
- `dev` 启用源码 reload；独立 `start` 入口不启用 reload。
- 不读取 Ark API Key，不写 `.env`，不把凭据放入参数或日志。

Python 的模块入口和配置解析通过 pytest 覆盖。既有 `/v1/health` JSON 契约保持不变，`/v1/run` 继续返回 404。

## Electron Main 与未来生命周期边界

本阶段 Electron Main 运行时代码不连接 FastAPI，也不增加 health probe。开发进程所有权如下：

```text
Turbo owns Electron dev process
Turbo owns Uvicorn dev process
Electron Main owns neither development child process
```

未来打包 sidecar 任务再实现如下概念接口：

```ts
interface AgentServiceLifecycle {
  start(): Promise<void>;
  stop(): Promise<void>;
}
```

未来实现必须由 Electron Main 持有，并进一步定义 executable 解析、随机或受控端口、ready 探测、启动超时、崩溃处理、stdout/stderr 上限、关闭顺序和 Windows/macOS 清理。本阶段只在设计中保留这一扩展点；不向生产代码添加未调用类型、no-op 实现或测试专用开关。

## 失败与终止语义

- Python 入口配置无效或端口被占用时退出非零，并由 Turbo 原样报告对应任务失败。
- Electron 启动失败时由 Forge 任务退出非零，并由 Turbo 报告。
- 用户终止根 `pnpm dev` 时，验收必须确认两个持久任务都收到终止并退出；若目标工具在 Windows 上存在信号传播缺陷，应先定位根因，不能用遗留后台进程伪装成功。
- 不吞掉子任务异常，不自动选择未知端口，也不通过 shell 字符串拼接命令。

## 测试与验收

实现遵循 TDD，并至少覆盖：

1. 工作区与根脚本测试先证明缺少 `dev`/filter 命令，再验证 agent-service 被 Turbo 识别。
2. Python 测试先证明可执行入口缺失，再验证 host、默认端口、合法覆盖和非法端口失败。
3. 既有 FastAPI health 与 `/v1/run` 404 契约继续通过。
4. Turbo dry-run 或等价结构化输出证明根 `dev` 精确包含 desktop 与 agent-service 两个任务，且任务为 persistent、不可缓存。
5. `pnpm dev:agent` 实际启动后，真实 HTTP 请求能得到严格的 `/v1/health` 响应，并能干净终止。
6. `pnpm dev` 实际启动 Electron 和 FastAPI；验证真实 Electron 窗口、FastAPI health、根命令终止后的进程清理。
7. 运行相关 lint、typecheck、Node/Vitest/pytest 测试、boundary/skill gate、构建、Forge package/ASAR，以及 `git diff --check`。macOS 原生行为只能由 macOS runner 声明通过。

## 文档同步

完成后更新 README、系统概览和开发工作流，明确：

- 当前已有源码开发态一键全栈启动和后端独立入口。
- Electron Main 当前不管理或等待 FastAPI。
- 打包 sidecar、业务调用、SSE 和生图链路仍是未来工作。
