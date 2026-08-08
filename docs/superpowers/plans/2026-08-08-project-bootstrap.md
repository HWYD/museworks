# Museworks Project Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可运行、可测试的 Museworks 最小桌面与本地服务工程骨架，固化跨进程边界而不实现生图产品能力。

**Architecture:** pnpm/Turbo 管理 Electron renderer、Electron main/preload 以及 Python service 三个独立交付单元。Renderer 只能调用 preload 暴露的窄接口；main 通过受控 HTTP 调用本地 FastAPI，未来流式接口一律保留给标准 SSE，不在此计划的 Bootstrap 中提前实现。每项任务独立通过 TDD 与提交后，才能作为下一项的输入。

**Tech Stack:** Node 22.22.2、pnpm 10.33.2、Turbo、Electron 43.2.0、Electron Forge 7.11.2、React 19.2.4、TypeScript 5.9.3、Python 3.12、uv、FastAPI、pytest。

## Global Constraints

- Node 必须为 `22.22.2`，pnpm 必须为 `10.33.2`，Python 必须为 `3.12`。
- Electron 必须为 `43.2.0`、Electron Forge 为 `7.11.2`、React 为 `19.2.4`、TypeScript 为 `5.9.3`；不以范围版本替代这些锁定版本。
- 固定调用方向为 `Renderer → Preload → Electron Main → FastAPI → Agent Runtime → Tool → ComfyUI Adapter`；不得跨层绕过。
- Renderer 不可访问 Node、文件系统、环境变量、密钥、ComfyUI 或任意 HTTP 后端。
- Electron 使用 `contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`，IPC 仅允许显式、类型化通道。
- `window.museworks.app.getInfo(): Promise<{ appVersion: string; platform: "win32" | "darwin"; arch: "x64" | "arm64" }>` 是 renderer 唯一的 Bootstrap bridge。Main 必须在运行时拒绝不受支持的平台或架构。
- `GET /v1/health` 必须返回 `{ "status": "ok", "service": "museworks-agent", "protocolVersion": 1 }`。
- 未来外部流式仅标准 SSE（`text/event-stream`）；禁止 NDJSON。本计划不得提前实现 run 或流式端点。
- 任何密钥仅在受控 main/service 环境读取，绝不传给 preload、renderer、日志或错误响应。
- 8GB 参考设备的默认未来生成基线只能是 `batch=1`、`768x768`、关闭 preview、动态显存/CPU offload；`1024x1024` 须经 RTX 3060 Ti 8GB 实机门禁，禁止预先宣称稳定。
- 生产行为采用 TDD；纯人类文档无需脆弱测试，测试不得为了可测性而污染生产 API 或架构。

---

## File Structure

```text
.
├── package.json                         # 根脚本、packageManager 与 engines
├── pnpm-workspace.yaml                  # Node workspace 边界
├── turbo.json                           # 构建与验证任务图
├── apps/
│   ├── desktop/
│   │   ├── package.json                 # Electron Forge/React 应用
│   │   ├── forge.config.ts              # Forge 43.2.0 配置和安全打包入口
│   │   ├── src/main/index.ts            # 安全 BrowserWindow 与 IPC handler
│   │   ├── src/preload/index.ts         # 受限 contextBridge API
│   │   ├── src/renderer/main.tsx        # React 19.2.4 入口
│   │   ├── src/renderer/app.tsx         # 只读取 app info 的壳页面
│   │   └── tests/
│   │       ├── preload.test.ts          # bridge 形状测试
│   │       └── main-security.test.ts    # BrowserWindow 安全选项测试
│   └── agent-service/
│       ├── pyproject.toml               # Python 3.12、FastAPI、pytest
│       ├── src/museworks_agent/main.py  # FastAPI app 和 health route
│       └── tests/test_health.py         # HTTP 契约测试
├── packages/
│   └── contracts/
│       ├── package.json                 # 仅 Electron IPC contracts workspace
│       ├── tsconfig.json                # contracts TypeScript 构建配置
│       └── src/ipc.ts                   # Zod schema、类型与 protocol version
├── scripts/ci-workflow.test.mjs         # CI 版本与关键命令静态测试
└── .github/workflows/ci.yml             # Node/Python 边界验证
```

### Task 1: pnpm/Turbo 工作区与边界校验

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.node-version`
- Create: `scripts/verify-boundaries.mjs`
- Create: `scripts/verify-boundaries.test.mjs`

**Interfaces:**
- Consumes: 无。
- Produces: `pnpm verify:boundaries`，退出码 `0` 表示递归扫描的 renderer 源文件中没有 Node built-in 或后端 HTTP 的违规 import；校验器先把 Windows `\\` 规范化为 `/`；`turbo run check` 聚合各包的 `check` 脚本。

- [ ] **Step 1: 写出失败的边界测试**

```js
import assert from 'node:assert/strict';
import { validateSource } from './verify-boundaries.mjs';

assert.throws(
  () => validateSource('src\\renderer\\bad.ts', "import fs from 'node:fs';"),
  /renderer must not import Node built-ins/,
);
assert.throws(
  () => validateSource('src/renderer/bad.ts', "fetch('http://127.0.0.1:8000/v1/health')"),
  /renderer must not call backend HTTP/,
);
```

- [ ] **Step 2: 运行测试确认 red**

Run: `node --test scripts/verify-boundaries.test.mjs`
Expected: FAIL，原因是 `verify-boundaries.mjs` 尚不存在或未导出 `validateSource`。

- [ ] **Step 3: 实现最小工作区和校验器**

```js
export function validateSource(path, source) {
  const normalizedPath = path.replaceAll('\\', '/');
  if (normalizedPath.includes('/renderer/') && /from ['\"]node:/.test(source)) {
    throw new Error('renderer must not import Node built-ins');
  }
  if (normalizedPath.includes('/renderer/') && /\b(fetch|axios)\s*\(/.test(source)) {
    throw new Error('renderer must not call backend HTTP');
  }
}
```

在根 `package.json` 设定 `"packageManager": "pnpm@10.33.2"`、`"engines": { "node": "22.22.2" }`，让 `verify:boundaries` 递归读取 `apps/**/src/renderer/**/*.{ts,tsx}` 后逐一调用 `validateSource`，并将 `test:boundaries` 和 `verify:boundaries` 接到 `turbo.json` 的 `check` 任务。

- [ ] **Step 4: 运行 green 与工作区验证**

Run: `node --test scripts/verify-boundaries.test.mjs && pnpm verify:boundaries`
Expected: PASS；命令退出码为 `0`。

- [ ] **Step 5: 提交 Task 1**

```bash
git add package.json pnpm-workspace.yaml turbo.json .node-version scripts
git commit -m "chore: bootstrap pnpm turbo workspace"
```

### Task 2: contracts 与安全 Electron/React 壳

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/forge.config.ts`
- Create: `apps/desktop/src/main/index.ts`
- Create: `apps/desktop/src/preload/index.ts`
- Create: `apps/desktop/src/renderer/main.tsx`
- Create: `apps/desktop/src/renderer/app.tsx`
- Create: `apps/desktop/tests/preload.test.ts`
- Create: `apps/desktop/tests/main-security.test.ts`
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/ipc.ts`

**Interfaces:**
- Consumes: Task 1 的 Node 22.22.2/pnpm workspace 和 `turbo run check`。
- Produces: `window.museworks.app.getInfo(): Promise<{ appVersion: string; platform: "win32" | "darwin"; arch: "x64" | "arm64" }>`；`getInfo` 的 IPC 请求只能由 preload 调用。`packages/contracts` 在本轮仅承载 Electron IPC 的 Zod schema、类型和数字 protocol version；FastAPI HTTP 的 Pydantic/OpenAPI 合约生成留给下一阶段，不在两个 workspace 重复手写 DTO。

- [ ] **Step 1: 写出 preload bridge 的失败测试**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createMuseworksApi } from '../src/preload/index';

it('exposes only app.getInfo', async () => {
  const api = createMuseworksApi({ invoke: vi.fn().mockResolvedValue({ appVersion: '0.0.0', platform: 'win32', arch: 'x64' }) });
  expect(Object.keys(api)).toEqual(['app']);
  await expect(api.app.getInfo()).resolves.toEqual({ appVersion: '0.0.0', platform: 'win32', arch: 'x64' });
});
```

- [ ] **Step 2: 运行测试确认 red**

Run: `pnpm --filter @museworks/desktop test -- tests/preload.test.ts`
Expected: FAIL，原因是 package、`createMuseworksApi` 或 contracts 尚不存在。

- [ ] **Step 3: 最小实现安全边界和 UI**

```ts
import { z } from 'zod';

export const PROTOCOL_VERSION = 1 as const;
export const appInfoSchema = z.object({
  appVersion: z.string(),
  platform: z.enum(['win32', 'darwin']),
  arch: z.enum(['x64', 'arm64']),
});
export type AppInfo = z.infer<typeof appInfoSchema>;
export const IPC_GET_APP_INFO = 'museworks:app:get-info' as const;

export function createMuseworksApi(ipcRenderer: Pick<Electron.IpcRenderer, 'invoke'>) {
  return { app: { getInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IPC_GET_APP_INFO) } };
}
```

在 `packages/contracts/package.json` 和 `packages/contracts/tsconfig.json` 配置独立 workspace，并在 `apps/desktop/package.json` 声明 `"@museworks/contracts": "workspace:*"`。在 `main/index.ts` 用 `narrowPlatform(value: string): AppInfo['platform']` 与 `narrowArch(value: string): AppInfo['arch']` 显式窄化 `process.platform`、`process.arch`，不受支持的值必须抛错；再由 `ipcMain.handle(IPC_GET_APP_INFO, ...)` 结合 `appInfoSchema` 校验 `app.getVersion()` 与窄化后的值并返回，不能将宽泛的 Node 运行时字符串泄露给 renderer。创建 `BrowserWindow` 时固定 `contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`。renderer 仅调用 `window.museworks.app.getInfo()` 并渲染结果，不调用 HTTP、Node 或环境变量。

- [ ] **Step 4: 增加 main 安全选项测试并运行 green**

```ts
expect(createWindowOptions().webPreferences).toMatchObject({
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
});
expect(() => createAppInfo('0.0.0', 'linux', 'x64')).toThrow(/unsupported platform/);
expect(() => createAppInfo('0.0.0', 'win32', 'ia32')).toThrow(/unsupported architecture/);
```

Run: `pnpm --filter @museworks/desktop test -- tests/preload.test.ts tests/main-security.test.ts`
Expected: PASS；两项测试均通过。

- [ ] **Step 5: 提交 Task 2**

```bash
git add apps/desktop packages/contracts
git commit -m "feat: add secure desktop bootstrap shell"
```

### Task 3: uv/FastAPI health 服务

**Files:**
- Create: `apps/agent-service/pyproject.toml`
- Create: `apps/agent-service/src/museworks_agent/__init__.py`
- Create: `apps/agent-service/src/museworks_agent/main.py`
- Create: `apps/agent-service/tests/test_health.py`

**Interfaces:**
- Consumes: Task 1 的 CI/task naming 约定。
- Produces: `GET /v1/health -> 200`，JSON 严格为 `{status: "ok", service: "museworks-agent", protocolVersion: 1}`。
  本服务不含 `/v1/run`、SSE 或 Ark/ComfyUI 集成。

- [ ] **Step 1: 写出失败的 HTTP 契约测试**

```python
from fastapi.testclient import TestClient
from museworks_agent.main import app

def test_health_returns_versioned_service_contract() -> None:
    response = TestClient(app).get('/v1/health')
    assert response.status_code == 200
    assert response.json() == {'status': 'ok', 'service': 'museworks-agent', 'protocolVersion': 1}
    assert isinstance(response.json()['protocolVersion'], int)
```

- [ ] **Step 2: 运行测试确认 red**

Run: `uv run --project apps/agent-service pytest apps/agent-service/tests/test_health.py -q`
Expected: FAIL，原因是 `museworks_agent.main` 尚不存在。

- [ ] **Step 3: 实现最小 FastAPI app**

```python
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: Literal['ok']
    service: Literal['museworks-agent']
    protocolVersion: Literal[1] = 1

app = FastAPI()

@app.get('/v1/health', response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status='ok', service='museworks-agent', protocolVersion=1)
```

在 `pyproject.toml` 固定 `requires-python = ">=3.12,<3.13"`，并声明 FastAPI、pytest、httpx；`HealthResponse` 仅是该 FastAPI 端点的 response model，不导入或镜像 `packages/contracts`。不加入 Ark、Deep Agents、ComfyUI、SSE 或模型依赖。

- [ ] **Step 4: 运行 green 与服务启动检查**

Run: `uv run --project apps/agent-service pytest apps/agent-service/tests/test_health.py -q`
Expected: PASS，`1 passed`。

Run: `uv run --project apps/agent-service python -c "from museworks_agent.main import app; assert any(route.path == '/v1/health' for route in app.routes)"`
Expected: 退出码为 `0`。

- [ ] **Step 5: 提交 Task 3**

```bash
git add apps/agent-service
git commit -m "feat: add agent health service"
```

### Task 4: CI、文档与全量验证

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `scripts/ci-workflow.test.mjs`
- Modify: `README.md`
- Modify: `docs/architecture/system-overview.md`
- Modify: `docs/architecture/development-workflow.md`

**Interfaces:**
- Consumes: Task 1 的 `pnpm verify:boundaries`，Task 2 的 desktop test 命令，Task 3 的 `uv run --project apps/agent-service pytest`。
- Produces: 对 pull request 和 main push 执行 Node 22.22.2/pnpm 10.33.2 与 Python 3.12 验证的 GitHub Actions；README 仅描述当前 bootstrap 能力和非目标。

- [ ] **Step 1: 写出失败的 CI 配置静态测试**

```js
import fs from 'node:fs';
import assert from 'node:assert/strict';

const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
assert.match(workflow, /node-version: 22\.22\.2/);
assert.match(workflow, /python-version: '3\.12'/);
assert.match(workflow, /pnpm verify:boundaries/);
```

- [ ] **Step 2: 运行测试确认 red**

Run: `node --test scripts/ci-workflow.test.mjs`
Expected: FAIL，原因是 `.github/workflows/ci.yml` 尚不存在。

- [ ] **Step 3: 最小实现 CI 与范围准确的文档**

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22.22.2
- run: corepack enable && corepack prepare pnpm@10.33.2 --activate
- run: pnpm verify:boundaries
```

添加 Python 3.12 job，依次运行 Task 3 的 pytest；Node job 运行边界检查和 desktop tests。README 与架构文档必须说明当前仅有 app-info/health 骨架，未提供生成、Ark、ComfyUI 或 SSE run 能力。

- [ ] **Step 4: 运行全量 green 验证**

Run: `node --test scripts/ci-workflow.test.mjs scripts/verify-boundaries.test.mjs && pnpm verify:boundaries && pnpm --filter @museworks/desktop test && uv run --project apps/agent-service pytest apps/agent-service/tests -q`
Expected: 所有命令退出码为 `0`，无失败测试。

- [ ] **Step 5: 提交 Task 4**

```bash
git add .github/workflows/ci.yml README.md docs/architecture scripts/ci-workflow.test.mjs
git commit -m "ci: verify bootstrap boundaries"
```

## Final Verification and Review

- [ ] 运行 `git diff --check`；预期退出码为 `0`。
- [ ] 运行 `git status --short`；预期仅含本任务准备提交的文件，且不含 `.superpowers/`、依赖、模型、凭据和构建物。
- [ ] 逐项复查 `## Global Constraints`：版本、IPC、health 契约、SSE-only、密钥和 8GB 表述均由对应任务覆盖。
- [ ] 在合并前安排独立审查，确认没有引入 run、流式、Ark、Deep Agents、ComfyUI、模型下载或签名实现。
