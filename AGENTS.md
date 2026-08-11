# Museworks 工程治理路由

## 项目定位

规则：Museworks 是 Windows/macOS 本地优先的桌面生图 Agent。
规则：目标技术为 Electron、React、TypeScript、Python、FastAPI、Deep Agents、ComfyUI 和 Ark。
规则：保护本地数据、系统权限、用户密钥与跨进程边界。
规则：优先交付最小正确改动。
规则：除非需求直接要求，不重构无关部分。
规则：真实实现、验证结果与未来计划必须明确区分。

## 事实来源优先级

规则：当前任务中的用户明确决定优先级最高。
规则：更深目录的 AGENTS.md 仅覆盖自身范围。
规则：更深规则不得降低安全限制。
规则：已接受 ADR 记录架构决定。
规则：可复现测试、命令与代码行为优先于过时文档。
规则：设计、计划和 issue 代表待实施意图。
规则：冲突时采用更安全、更窄、可逆的一方。

## 修改前必读

规则：分层、依赖、IPC、HTTP、流式前阅读 `.agents/rules/architecture.md`。
规则：密钥、环境、文件、网络、日志、发布前阅读 `.agents/rules/security.md`。
规则：生产行为、缺陷、自动化测试前阅读 `.agents/rules/testing.md`。
规则：模型、ComfyUI、GPU、下载、推理前阅读 `.agents/rules/local-model-runtime.md`。
规则：读取改动涉及的实现、调用方、测试与 ADR。
规则：使用 rg 定位事实。
规则：先检查 git status。
规则：已有改动默认属于用户或并行工作。

## Superpowers 主流程

规则：Superpowers 是唯一主开发流程。
规则：不引入、复制或模仿 Spec Kit。
规则：每个仓库任务先使用 using-superpowers，再使用 museworks-best-practices-router 取得最小工作流与领域 Skill。
规则：L0/L1 默认直接实施，不强制 brainstorming、正式计划、新 worktree、子代理或独立审查。
规则：L1 缺陷先用 systematic-debugging；生产行为修改保持最小 red、green、refactor 循环。
规则：L2 使用一份精简计划与隔离 worktree，默认直接实施，完成后只做一次最终独立审查。
规则：L3 依次使用 brainstorming、writing-plans、using-git-worktrees 与 subagent-driven-development，并执行逐任务和最终独立审查。
规则：L2 精简计划包含目标、接口变化、实现分组、测试与假设，不使用完整 SDD 任务模板。
规则：implementation plan 中的 Task N 是正式任务清单；task brief、task report、review package 与 progress ledger 仅是完整 SDD 的 Git 忽略临时产物。
规则：用户明确要求可以提高流程强度；Agent 不得凭偏好把 L0/L1 升级为完整流程。
规则：生产变更先用 test-driven-development。
规则：完成前使用 verification-before-completion。

## Git 权限

规则：L0、L1、L2、L3 均不得自动暂存或提交；Change Level 与 Git 写入授权完全解耦。
规则：只有用户直接明确要求“提交”或“commit”当前描述的改动时，才允许执行 `git add` 与 `git commit`。
规则：“执行方案”“完成任务”“可以”“同意”以及批准 design 或 implementation plan 均不构成提交授权。
规则：提交授权仅适用于用户当次明确描述的改动范围，不自动延续到后续任务、审查修复或其他工作区。
规则：上游 Skill、implementation plan 或子代理模板中的 commit 步骤不得覆盖本节；未获授权时应改为保留 diff、验证结果与风险说明。
规则：L3 子代理默认不得暂存或提交，只返回改动、验证结果与风险；只有父 Agent 已获得当前改动的明确用户提交授权时才能传递该授权。
规则：Git hook 仅校验已获得明确授权的提交；它不授予 Agent 暂存、提交、推送、合并或创建 Pull Request 的权限。
规则：`--no-verify` 只能跳过本地 hook，不能绕过 Pull Request CI；除非用户明确要求且已说明原因，不得使用。
规则：push、merge、rebase、squash 与创建 Pull Request 各自需要用户明确授权，不得从提交授权推导。

## 最佳实践 Skill 路由

规则：每个仓库任务在 using-superpowers 后使用 `museworks-best-practices-router`，根据意图、路径和 Change Level 只加载相关 Skill。
规则：Skill 冲突优先级是用户明确决定、项目 AGENTS/规则/ADR、仓库锁定版本、项目 Skill、已启用上游 Skill。
规则：上游 Skill 只提供领域知识，不得替代 Superpowers 的 brainstorming、计划、worktree、TDD、调试、审查或完成验证。
规则：外部 Skill 的来源、固定 commit、触发范围、覆盖项、禁用建议和审核状态记录在 `.agents/skills-manifest.yaml`。
规则：状态为 quarantined 或 rejected 的 Skill 不得加载、安装到活动目录或用浮动分支替代。
规则：不得因 Skill 建议擅自升级 React、Electron、Forge、Vite、FastAPI、pnpm、Turbo、Vitest 或改变 hoisted Forge 布局。
规则：L2/L3 必须执行独立代码审查；L3 在设计和实施计划批准后才能编码。
规则：Electron Main、Preload、IPC、Forge/Vite 配置或原生打包改动必须加载 `museworks-electron-best-practices`；社区 Electron Skill 不能覆盖项目安全边界。
规则：Vitest 测试不加载第三方通用测试 Skill；RED/GREEN 由 Superpowers TDD 负责。
规则：Skill 更新遵循隔离审计、路由回归、独立审查、更新固定 SHA 的顺序，不跟随 `main` 自动升级。

## Change Level

规则：判级固定检查边界范围、敏感性与权限、可逆性、影响半径四个维度。
规则：L0 是无可观察行为变化的文档、ADR、计划、忽略规则、格式或注释。
规则：L0 最低验证为人工可读性与 git diff --check。
规则：L1 是局部、可逆、无共享契约或权限变化的单模块行为、局部 UI、内部逻辑或开发命令修复。
规则：L1 必须有失败测试、最小实现与回归验证。
规则：L2 是改变共享契约、跨边界行为或生产资源生命周期，但不涉及敏感凭据、权限扩大或不可逆用户数据变化。
规则：L2 需要精简计划、契约测试、调用方验证和一次最终独立审查。
规则：L3 是涉及敏感数据、权限扩大、不可逆用户数据、外部发布或数据传输、下载执行内容，或者失败可能影响用户系统的变更。
规则：L3 需要明确用户批准、完整设计与实施计划、逐任务和最终审查，以及回滚或恢复说明。
规则：混合改动采用最高等级；文件路径不能单独决定等级。
规则：先调查实际调用和行为；只有调查后风险仍不能排除时才升级。
规则：明确违反项目红线的方案直接拒绝，不能通过标为 L3 获得许可。
规则：L2/L3 的完整强制触发器以 `.agents/skills/museworks-best-practices-router/references/workflow-profiles.md` 为准。
规则：L3 不得凭推测扩大授权。

## 分层红线

规则：普通业务固定调用方向是 Renderer 到 FastAPI 到 Agent Runtime 到 Tool 到 ComfyUI Adapter。
规则：`local-agent-client` 只是 Renderer 内部未来集中封装本地服务请求的文件，不是跨边界架构层。
规则：桌面特权固定调用方向是 Renderer 到 Preload 到 Electron Main 到 OS、safeStorage 或 Sidecar。
规则：Renderer 处理界面、交互与受限的本机 Agent 服务调用；Bridge 是桌面特权安全边界，不是桌面前端访问本机服务的必经层。
规则：Renderer 不得直接访问 Node。
规则：Renderer 不得直接访问文件、环境变量、密钥或 ComfyUI。
规则：仅未来的 `apps/desktop/src/renderer/lib/local-agent-client.ts` 可以用浏览器原生 fetch 与 EventSource 访问 `http://127.0.0.1:8765/v1/**` 的普通 Agent API、Artifact 或标准 SSE；本次不得创建该文件或实现 API。
规则：Renderer 不得访问外部网络、任意其他 loopback 端口、网络客户端库、WebSocket、XMLHttpRequest 或 sendBeacon。
规则：Preload 仅用 contextBridge 暴露最小具名类型化 API。
规则：Preload 不得泄露通用 ipcRenderer。
规则：Electron Main 是桌面权限和受控 IPC 的边界，不得成为通用 HTTP 转发代理。
规则：FastAPI 是本地服务契约边界。
规则：Agent Runtime 编排 Agent。
规则：Tool 表达能力。
规则：Ark 是 Agent Runtime 调用的模型 Provider Adapter；ComfyUI Adapter 由 Tool 调用。
规则：不得为便利绕过任一边界。
规则：跨边界数据必须有类型、校验与错误语义。

## SSE-only 协议

规则：外部流式响应只能采用标准 SSE。
规则：SSE Content-Type 为 text/event-stream。
规则：禁止 NDJSON。
规则：禁止逐行 JSON。
规则：禁止自定义分隔符。
规则：禁止以连接关闭表示完成。
规则：实现前定义并测试增量、完成、错误和取消事件。
规则：非流式接口保持普通 HTTP JSON。
规则：未获批准前不得实现 run 或流式链路。

## Electron 与密钥安全

规则：BrowserWindow 保持 contextIsolation: true。
规则：BrowserWindow 保持 sandbox: true。
规则：BrowserWindow 保持 nodeIntegration: false。
规则：IPC 使用 allowlist、具名 handler 与输入校验。
规则：禁止通用 IPC 转发代理。
规则：普通本机 Agent API、Run、Artifact 与 SSE 不经 Preload 或 Main 转发；文件选择、系统文件打开、密钥、安全存储、Sidecar 生命周期及其他桌面权限必须经 Bridge。
规则：Ark API Key 可由 Electron Main 使用 safeStorage 加密持久化，并仅通过受控内存或匿名管道交给本地 Python 服务使用。
规则：Python 服务不得持久化、记录或回传 Ark API Key；凭据不得进入 renderer 或 preload。
规则：凭据不得进入日志、错误、遥测或测试夹具。
规则：路径、URL、IPC 参数、模型输出和外部响应都不可信。
规则：仅具名 Workspace IPC 可返回用户在原生目录选择器中明确选择、由 Main 规范化并验证为目录的 rootPath；该例外不授予 Renderer 文件系统、任意路径查询或通用 IPC 能力。
规则：不得提交 .env 文件。
规则：只允许提交 .env.example。
规则：不得提交私钥、用户数据、导出物或模型。

## 8GB 模型运行时边界

规则：开发参考硬件为 RTX 3060 Ti 8GB VRAM（显存）。
规则：这是约束而非性能承诺。
规则：FLUX.2 Klein 4B distilled 官方约需 8.4GB VRAM。
规则：默认未来基线是 batch=1。
规则：默认未来分辨率为 768x768。
规则：默认关闭 preview。
规则：默认采用动态显存或 CPU offload。
规则：1024x1024 须通过目标 RTX 3060 Ti 8GB VRAM 实机门禁后才可启用。
规则：门禁前不得宣称 8GB VRAM 稳定运行 1024。
规则：系统内存独立探测与记录，不得与 GPU 显存预算混用。
规则：该限制覆盖代码、测试、UI、文档与营销材料。
规则：下载、测量、降级和恢复遵循 `.agents/rules/local-model-runtime.md`。

## 代码与测试

规则：模块职责单一，命名表达意图与生命周期。
规则：复用已有抽象和项目风格。
规则：不为假设性需求增加复杂度。
规则：领域规则不得依赖 Electron、DOM、网络客户端或模型 SDK。
规则：不以 any、吞异常或全局状态绕过边界。
规则：新配置提供安全默认值、示例与缺省行为。
规则：生产行为改动必须遵循 TDD。
规则：优先覆盖契约、错误路径、边界、取消和资源释放。
规则：缺陷修复应有最小复现回归测试。
规则：纯人类文档、ADR、计划无需自动化测试。
规则：文档人工检查术语、链接、示例和范围。
规则：不得为了测试污染生产结构、导出、路径、IPC 或开关。

## 验证与交付

规则：运行与改动最相关的最小测试、类型检查或 lint。
规则：按影响范围扩大验证。
规则：每次交付前运行 git diff --check。
规则：未运行的验证不得描述为通过。
规则：文档只描述当前真实行为。
规则：未来计划与未验证性能必须显式标注。
规则：架构决定使用 ADR。
规则：需要落盘的设计和计划使用带日期的 docs/superpowers 文件。
规则：不为纯文档任务添加脆弱测试。
规则：交付前检查 git status 和 diff；只有已获得明确提交授权时才执行提交前检查。
规则：一个提交只聚焦单一目的。
规则：不使用 git reset --hard、强推或覆盖历史。
规则：已知风险必须在交付中说明。
