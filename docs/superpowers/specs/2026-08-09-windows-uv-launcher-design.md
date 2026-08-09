# Museworks Windows uv 启动兜底设计

**日期：** 2026-08-09
**状态：** 已批准，待书面复核
**变更等级：** L2（跨 workspace 开发进程启动契约）

## 背景与根因

当前 `@museworks/agent-service` 的 `dev`、`start`、`test` 和 `check` 脚本直接执行 `uv`。在已安装 uv、但当前 PowerShell 尚未包含其安装目录的 Windows 环境中，`pnpm dev` 无法启动 FastAPI。

本机证据为：

- `Get-Command uv` 与 `where.exe uv` 均找不到命令；
- `C:\Users\HWY\.local\bin\uv.exe` 存在并报告 `uv 0.11.32`；
- 临时把该目录加入 `PATH` 后，同一 agent `check` 命令立即通过；
- 未找到命令时，Windows `cmd.exe` 输出本地代码页文本，进一步触发 Turbo 2.2.3 的“非 UTF-8 byte sequences”控制台错误。

Astral 官方把 `%USERPROFILE%\.local\bin` 定义为 Windows 默认用户可执行目录。项目需要在不修改用户全局环境的前提下识别这个官方安装位置，并把“找不到 uv”转换为稳定、可操作的 UTF-8 错误。

## 目标

- `pnpm dev` 和 `pnpm dev:agent` 在 uv 已安装于 Windows 官方默认目录、但该目录不在当前 `PATH` 时仍可启动 FastAPI。
- agent workspace 的 `dev`、`start`、`test`、`check` 共用同一个 uv 解析入口，避免根启动已修复而测试或检查仍失败。
- `PATH` 中的 uv 始终优先，保留 WinGet、Scoop、系统级安装和 CI `setup-uv` 的正常行为。
- 无可用 uv 时快速失败，并输出由 Node 生成的 UTF-8 安装提示，不再依赖本地化的 shell“命令不存在”文本。
- uv 子进程继承当前工作目录、标准输入输出和原始参数，退出码与失败保持可观察。

## 非目标

- 不自动下载、安装或升级 uv。
- 不修改系统或用户 `PATH`、PowerShell profile、注册表或 shell 配置。
- 不改变锁定的 uv 0.11.32、pnpm 10.33.2、Turbo 2.2.3 或其他工具版本。
- 不增加第三方进程管理器或 Node 运行时依赖。
- 不改变 Turbo 同时持有 Electron 与 FastAPI 的设计，也不让 Electron Main 启动、等待或探测 FastAPI。
- 不修改 FastAPI 路由、HTTP/SSE、IPC、模型或打包 sidecar 行为。

## 方案比较

### 方案 A：package 级跨平台 Node 启动器（采用）

增加仓库脚本解析 uv 后直接转发参数。解析顺序为：

1. 当前 `PATH` 中与平台匹配的 uv 可执行文件；
2. Windows 官方默认目录 `%USERPROFILE%\.local\bin\uv.exe`；
3. 若仍未找到，以 UTF-8 错误和非零退出码终止。

优点是四个 agent 命令使用同一规则，CI 和其他安装方式仍以 `PATH` 优先；无需修改全局环境，也不重复 Turbo 的编排职责。代价是增加一个很小的进程转发层，需要验证参数、退出码和 Ctrl+C 清理。

### 方案 B：根命令启动前临时扩展 PATH

根脚本先修改子进程环境，再启动 Turbo。实现较短，但只覆盖从根命令进入的路径；package 级 `test`、`check` 或直接运行仍可能失败，而且根脚本会承担本应属于 package 的工具定位逻辑，因此不采用。

### 方案 C：只更新文档，继续强制要求 PATH

没有代码成本，但当前错误不具可操作性，旧终端、IDE 和桌面启动器仍会遇到同一问题；也无法消除 Turbo 的次生编码异常，因此不采用。

## 组件与数据流

新增 `scripts/run-uv.mjs`，职责仅为：

1. 根据平台、环境和文件可执行性解析 uv；
2. 使用参数数组启动解析出的可执行文件，不使用 shell 字符串拼接；
3. 继承 `stdio` 与当前工作目录；
4. 传播正常退出码和失败；
5. 找不到 uv 时给出固定、可操作的 UTF-8 错误。

调用关系保持为：

```text
pnpm dev
└── turbo run dev
    ├── @museworks/agent-service#dev
    │   └── node ../../scripts/run-uv.mjs run --locked museworks-agent --reload
    │       └── resolved uv executable
    └── @museworks/desktop#dev
        └── Electron Forge/Vite
```

启动器不做网络访问、不安装依赖、不读取凭据，也不选择 Python 服务端口。所有 uv 参数仍由 agent package scripts 明确声明。

## 解析与错误语义

- Windows 解析 `PATH` 时使用平台路径分隔符和 `uv.exe`，忽略空条目；官方默认目录仅在 `USERPROFILE` 为非空绝对路径且目标文件存在时采用。
- macOS/Linux 本阶段继续使用 `PATH` 中的 `uv`；不猜测包管理器或自定义安装路径。
- 不调用 `where.exe`、`which` 或 shell，因此不会把本地代码页的“找不到命令”文本交给 Turbo。
- 找不到 uv 时，错误至少包含：缺失工具名、要求的版本 `0.11.32`、官方安装文档地址、Windows 默认检查路径和“重新打开终端或修复 PATH”的操作提示。
- 启动失败或 uv 返回非零时，启动器自身返回非零；不吞异常、不自动重试、不降级到未锁定的 Python 命令。

## 测试与验收

实现遵循 RED → GREEN：

1. 先增加 Node 测试，证明当前没有可复用的 uv 解析器，并覆盖 PATH 优先、Windows 官方目录回退、缺失失败和空环境边界。
2. 更新 workspace 契约测试，证明 agent 四个脚本全部经过同一启动器，不改变根 Turbo 命令与持久任务配置。
3. 最小实现启动器后运行聚焦 Node 测试和现有 workspace 配置测试。
4. 在本机从子进程 `PATH` 中移除 `%USERPROFILE%\.local\bin`，验证启动器仍能执行真实 `uv 0.11.32`。
5. 在同样的 PATH 条件下真实运行 `pnpm dev:agent`，轮询严格 health JSON 后按精确进程身份清理，并确认 8765 无监听。
6. 在同样的 PATH 条件下真实运行根 `pnpm dev`，确认 FastAPI health 与 Electron 窗口同时可用；按精确 PID/创建时间清理，不使用名称或通配 kill。
7. 运行 `pnpm test`、`pnpm check`、格式、边界、Skill 治理、Windows package/ASAR 和 `git diff --check`。

独立 L2 审查重点检查：无 shell 注入、路径优先级正确、错误可操作、四个 agent 命令一致、进程与退出码未被吞掉、Turbo 与 Electron Main 生命周期未改变。

## 文档同步

README 与开发工作流改为说明：uv 仍需预先安装并锁定为 0.11.32；Windows 官方默认安装目录可由项目启动器自动发现，其他安装位置应位于 `PATH`。不再宣称所有根命令执行前都必须由当前 shell 直接解析 `uv --version`。
