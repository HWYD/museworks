# 开发工作流

## 变更原则

每项功能先确定其所属边界，再实施最小改动：UI 属于 Renderer，受控桌面能力属于 Preload/Main，服务与编排属于 FastAPI/Agent Runtime，第三方差异属于 Adapter。

## 推荐流程

1. 明确用户场景、输入输出和资源约束。
2. 定义跨边界契约：IPC 方法、HTTP 请求、SSE 事件或工具参数。
3. 自内向外实现 Adapter 与 Tool，再实现 Agent Runtime、FastAPI、Main/Preload 和 Renderer。
4. 为新增边界补充最小自动化测试：契约、错误路径和流式结束路径。
5. 在目标资源基线上验证，记录实测限制，不以未验证的性能作承诺。

## 协议要求

- Renderer 只能通过 Preload 提供的 API 访问 Main。
- Main 与 FastAPI 的流式数据保持 SSE 语义直到 Renderer 消费端。
- SSE 事件必须有显式事件类型和结构化数据；错误与完成也必须是事件，而不是依赖断流或 NDJSON 行分隔推断。
- Agent Runtime 通过 Tool 调用 Adapter，不直接依赖 Ark 或 ComfyUI 的具体协议。

## 本地资源验证

8GB 内存是约束而非性能保证。任何涉及生成分辨率、并发或常驻模型的变更，都必须在目标配置上测量峰值内存、失败模式和恢复路径；未测量前不得声称稳定支持 1024 级生成。
