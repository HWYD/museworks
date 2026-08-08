# 开发工作流

## 变更原则

每项功能先确定其所属边界，再实施最小改动：UI 属于 Renderer，受控桌面能力属于 Preload/Electron Main，服务与编排属于 FastAPI/Agent Runtime，Ark 模型差异属于 Provider Adapter，ComfyUI 差异属于 Tool 后的 ComfyUI Adapter。

## 推荐流程

1. 明确用户场景、输入输出和资源约束。
2. 定义跨边界契约：IPC 方法、HTTP 请求、SSE 事件或工具参数。
3. 自内向外实现 Ark Provider Adapter、ComfyUI Adapter 与 Tool，再实现 Agent Runtime、FastAPI、Electron Main/Preload 和 Renderer。
4. 为新增边界补充最小自动化测试：契约、错误路径和流式结束路径。
5. 在目标资源基线上验证，记录实测限制，不以未验证的性能作承诺。

## 协议要求

- Renderer 只能通过 Preload 提供的 API 访问 Main。
- Main 与 FastAPI 的流式数据保持 SSE 语义直到 Renderer 消费端。
- SSE 事件必须有显式事件类型和结构化数据；错误与完成也必须是事件，而不是依赖断流或 NDJSON 行分隔推断。
- Agent Runtime 通过模型 Provider Adapter 调用 Ark，并通过 Tool 调用 ComfyUI Adapter，不直接依赖两者的具体协议。

## 本地资源验证

RTX 3060 Ti 8GB VRAM（显存）是开发参考门禁而非性能保证。任何涉及生成分辨率、并发或常驻模型的变更，都必须在目标配置上分别测量 GPU 峰值显存、系统内存、失败模式和恢复路径；未通过实机门禁前不得声称稳定支持 `1024x1024`。
