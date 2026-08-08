# Museworks Project Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可运行、可测试的 Museworks 最小桌面与本地服务工程骨架，固化跨进程边界而不实现生图产品能力。

**Architecture:** pnpm/Turbo 管理 Electron renderer、Electron main/preload 以及 Python service 三个独立交付单元。Renderer 只能调用 preload 暴露的窄接口；main 通过受控 HTTP 调用本地 FastAPI，未来流式接口一律保留给标准 SSE，不在此计划的 Bootstrap 中提前实现。每项任务独立通过 TDD 与提交后，才能作为下一项的输入。

**Tech Stack:** Node 22.22.2、pnpm 10.33.2、Turbo 2.2.3、Electron 43.2.0、Electron Forge 7.11.2、Forge Vite plugin 7.11.2、Vite 7.3.6、@vitejs/plugin-react 5.2.0、React 19.2.4、TypeScript 5.9.3、ESLint 9.39.1、Prettier 3.7.3、Vitest 4.1.4、Python 3.12、uv、FastAPI、pytest。

## Global Constraints

- Node 必须为 `22.22.2`，pnpm 必须为 `10.33.2`，Python 必须为 `3.12`。
- Electron 必须为 `43.2.0`、Electron Forge 及所有 `@electron-forge/*` packages 为 `7.11.2`、`@electron-forge/plugin-vite` 为 `7.11.2`、Vite 为 `7.3.6`、`@vitejs/plugin-react` 为 `5.2.0`、React 为 `19.2.4`、TypeScript 为 `5.9.3`、Turbo 为 `2.2.3`、ESLint 为 `9.39.1`、Prettier 为 `3.7.3`、Vitest 为 `4.1.4`；不以范围版本替代这些锁定版本。
- Electron 桌面构建只使用 Electron Forge + Vite，禁止 Webpack 工具链。Forge `7.11.2` 是稳定线，v8 仍为 alpha；Forge 官方 Vite plugin 标为 experimental，官方模板仍以 Vite `^5` 为基线，而 Vite 8 已切换至 Rolldown。Vite `7.3.6` 仍受支持，因此 MVP 固定该版本，并以精确锁版和 `start`、`build`、`package` 冒烟验证控制升级；仅在三个冒烟命令及 Windows/macOS CI matrix 均通过后，才可评估一次受控升级。
- 固定调用方向为 `Renderer → Preload → Electron Main → FastAPI → Agent Runtime → Tool → ComfyUI Adapter`；不得跨层绕过。
- Renderer 不可访问 Node、文件系统、环境变量、密钥、ComfyUI 或任意 HTTP 后端。
- Electron 使用 `contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`，IPC 仅允许显式、类型化通道。
- `window.museworks.app.getInfo(): Promise<{ appVersion: string; platform: "win32" | "darwin"; arch: "x64" | "arm64" }>` 是 renderer 唯一的 Bootstrap bridge。Main 必须在运行时拒绝不受支持的平台或架构。
- `GET /v1/health` 必须返回 `{ "status": "ok", "service": "museworks-agent", "protocolVersion": 1 }`。
- 未来外部流式仅标准 SSE（`text/event-stream`）；禁止 NDJSON。本计划不得提前实现 run 或流式端点。
- Ark API Key 可由 Electron Main 使用 `safeStorage` 加密持久化，并仅通过受控内存或匿名管道交给本地 Python 服务使用；Python 不持久化、记录或回传，preload 与 renderer 始终不可见。
- RTX 3060 Ti 8GB VRAM（显存）参考设备的默认未来生成基线只能是 `batch=1`、`768x768`、`preview=none`、动态显存或 CPU offload；`1024x1024` 须经该目标硬件实机门禁，禁止预先宣称稳定。系统内存另行探测和记录。
- 生产行为采用 TDD；纯人类文档无需脆弱测试，测试不得为了可测性而污染生产 API 或架构。

---

## File Structure

```text
.
├── package.json                         # 根脚本、packageManager 与 engines
├── pnpm-workspace.yaml                  # Node workspace 边界
├── pnpm-lock.yaml                       # pnpm 10.33.2 可复现依赖锁
├── turbo.json                           # 构建与验证任务图
├── tsconfig.json                         # strict 的共享 TypeScript 基线
├── eslint.config.mjs                     # 根级 ESLint 9 flat config
├── .prettierrc.json                      # 根级 Prettier 规则
├── .prettierignore                       # 不格式化依赖和构建产物
├── .editorconfig                         # 跨编辑器文本约定
├── .npmrc                                # pnpm 工作区安全、可复现设置
├── apps/
│   ├── desktop/
│   │   ├── package.json                 # Electron Forge/React 应用
│   │   ├── forge.config.ts              # Forge Vite 7.11.2 / Electron 43.2.0 配置
│   │   ├── vite.main.config.ts          # Vite main-process bundle 配置
│   │   ├── vite.preload.config.ts       # Vite preload bundle 配置
│   │   ├── vite.renderer.config.ts      # Vite React renderer 配置
│   │   ├── forge.env.d.ts               # Forge 注入的 Vite entrypoint 类型
│   │   ├── index.html                   # Vite renderer HTML entrypoint
│   │   ├── tsconfig.json                # desktop TypeScript 基线
│   │   ├── tsconfig.build.json          # desktop 可发射的骨架构建配置
│   │   ├── vitest.config.ts             # desktop test project 基线
│   │   ├── src/renderer/placeholder.ts  # Task 1 可编译的 renderer 骨架
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
│       ├── tsconfig.build.json          # contracts 可发射的骨架构建配置
│       ├── src/index.ts                 # Task 1 可编译的 package 入口
│       └── src/ipc.ts                   # Zod schema、类型与 protocol version
├── scripts/ci-workflow.test.mjs         # CI 版本与关键命令静态测试
└── .github/workflows/ci.yml             # Node/Python 边界验证
```

### Task 1: pnpm/Turbo 工作区与边界校验

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `pnpm-lock.yaml`
- Create: `turbo.json`
- Create: `tsconfig.json`
- Create: `eslint.config.mjs`
- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Create: `.editorconfig`
- Create: `.npmrc`
- Create: `.node-version`
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/tsconfig.json`
- Create: `apps/desktop/tsconfig.build.json`
- Create: `apps/desktop/vitest.config.ts`
- Create: `apps/desktop/src/renderer/placeholder.ts`
- Create: `apps/desktop/tests/scaffold.test.ts`
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/tsconfig.build.json`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/tests/scaffold.test.ts`
- Create: `scripts/verify-boundaries.mjs`
- Create: `scripts/verify-boundaries.test.mjs`

**Interfaces:**
- Consumes: 无。
- Produces: 可被 pnpm filter 匹配的 `@museworks/desktop` 与 `@museworks/contracts` workspace 基线，以及 `pnpm verify:boundaries`。校验器使用 TypeScript AST 检查 renderer 中的 Node 导入和网络 API 调用；先把 Windows `\\` 规范化为 `/`。`turbo run check` 聚合各包的 `check` 脚本。

- [ ] **Step 1: 写出失败的边界测试**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { validateSource } from './verify-boundaries.mjs';

const cases = [
  ['side-effect node import', "import 'node:fs';", /renderer must not import Node built-ins/],
  ['bare Node builtin', "import fs from 'fs';", /renderer must not import Node built-ins/],
  ['require', "const fs = require('node:fs');", /renderer must not import Node built-ins/],
  ['dynamic import', "await import('node:path');", /renderer must not import Node built-ins/],
  ['direct fetch', "fetch('http://127.0.0.1:8000/v1/health');", /renderer must not call network APIs/],
  ['axios method', "axios.get('http://127.0.0.1:8000/v1/health');", /renderer must not call network APIs/],
];

for (const [name, source, expected] of cases) {
  test(name, () => assert.throws(() => validateSource('src\\renderer\\bad.ts', source), expected));
}
```

先在 `verify-boundaries.mjs` 导出临时空实现 `export function validateSource() {}`，使测试模块可以加载且六类断言分别进入失败状态。每一类用例必须是独立测试；同时补充非 renderer 文件与普通 UI 代码不报错的负例，避免用单个脆弱正则宣称完整覆盖。

- [ ] **Step 2: 运行测试确认 red**

Run: `node --test scripts/verify-boundaries.test.mjs`
Expected: FAIL；测试报告明确显示六类禁止项各有一个失败断言，不能以模块加载失败代替逐类 red。

- [ ] **Step 3: 实现最小工作区和校验器**

使用 TypeScript compiler API 的 `createSourceFile` 与 AST visitor 实现 `validateSource`，不得以文本正则代替语法判断：

- `ImportDeclaration` 同时覆盖带绑定和 side-effect import；用 `node:module` 的 `builtinModules` 识别 `node:` 与裸 Node builtin（含子路径）。
- `CallExpression` 覆盖 `require('...')` 与 `import('...')` 的 Node builtin 参数。
- renderer 中直接调用标识符 `fetch(...)`，或调用 `axios.<method>(...)`，统一抛出 `renderer must not call network APIs`。
- 仅扫描规范化路径包含 `/renderer/` 的 `.ts`/`.tsx`，并遍历嵌套语法节点。

在根 `package.json` 固定 `"packageManager": "pnpm@10.33.2"`、`"engines": { "node": "22.22.2" }`，并将下列精确版本写入 root `devDependencies`：`typescript@5.9.3`、`turbo@2.2.3`、`eslint@9.39.1`、`@eslint/js@9.39.1`、`typescript-eslint@8.48.0`、`prettier@3.7.3`、`globals@16.5.0`、`vitest@4.1.4`。这些 root-only 工具负责统一的 TypeScript 编译、Turbo 调度、ESLint flat config、格式检查和 workspace 测试；不得把它们复制到每个 package。根脚本必须是下列实际聚合入口，不能以空命令、缺失 workspace filter 或恒真脚本取得成功：

```json
{
  "scripts": {
    "lint": "turbo run lint",
    "format:check": "prettier --check package.json pnpm-workspace.yaml turbo.json tsconfig.json eslint.config.mjs .prettierrc.json apps packages scripts",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "build": "turbo run build",
    "check": "turbo run check && pnpm verify:boundaries",
    "verify:boundaries": "node scripts/verify-boundaries.mjs"
  }
}
```

创建根 `tsconfig.json`（`"strict": true`，并提供 desktop/contracts 继承的 Node 22 基线）、`eslint.config.mjs`、`.prettierrc.json`、`.prettierignore`、`.editorconfig` 与 `.npmrc`。ESLint flat config 必须组合 `@eslint/js`、`typescript-eslint` 和 `globals`，为 `.ts` / `.tsx` 配置 TypeScript parser 与 JSX 解析，并实际检查源码和测试；Task 1 的 `format:check` 只显式检查有 Prettier parser 的 `package.json`、`pnpm-workspace.yaml`、`turbo.json`、`tsconfig.json`、`eslint.config.mjs`、`.prettierrc.json`、`apps`、`packages` 与 `scripts`，但不引用尚未创建的 `.github/workflows`。`.prettierignore`、`.editorconfig` 与 `.npmrc` 没有 Prettier parser，改由 Node 内容测试及人工配置审查检查。Task 4 创建 workflow 后再将 `.github/workflows` 加入同一脚本。既有治理 Markdown 不纳入自动格式门禁，由任务提交前的人工可读性、链接与范围审查保障。Prettier ignore 仅排除 `node_modules`、`dist`、`.turbo`、`.vite`、`out` 等依赖或构建目录，不排除上述机器维护源码、配置或测试；`.npmrc` 必须启用 `engine-strict=true`、`save-exact=true` 与 Forge 官方 pnpm 要求的 `node-linker=hoisted`。根 `package.json` 还必须声明 `"pnpm": { "onlyBuiltDependencies": ["electron", "electron-winstaller"] }`，只允许这两个原生安装脚本在 install 时构建。

创建最小 `apps/desktop` 与 `packages/contracts` manifests、继承根 strict 基线的 `tsconfig.json` / `tsconfig.build.json` 以及 desktop Vitest 配置，使 pnpm filter 在 Task 2 前已经匹配真实 workspace。`apps/desktop/package.json` 的 `dependencies` 必须精确包含 `react@19.2.4`、`react-dom@19.2.4`、`electron-squirrel-startup@1.0.1` 与 `@museworks/contracts@workspace:*`；`devDependencies` 必须精确包含 `electron@43.2.0`、`@electron-forge/cli@7.11.2`、`@electron-forge/plugin-vite@7.11.2`、`@electron-forge/plugin-fuses@7.11.2`、`@electron-forge/maker-squirrel@7.11.2`、`@electron-forge/maker-dmg@7.11.2`、`@electron-forge/shared-types@7.11.2`、`@electron/fuses@1.8.0`、`vite@7.3.6`、`@vitejs/plugin-react@5.2.0`、`@types/node@22.20.1`、`@types/react@19.2.14`、`@types/react-dom@19.2.3`、`jsdom@29.0.2`、`@testing-library/react@16.3.2`；不得列出任何 Webpack 工具链 package。`@electron/fuses@1.8.0` 是 plugin-fuses `7.11.2` 所要求 `^1.0.0` peer 范围内的最新 1.x，必须精确锁定，不能升级到不兼容的 2.x。`packages/contracts/package.json` 的 `dependencies` 必须精确包含 `zod@4.3.6`，因为 `packages/contracts/src/ipc.ts` 直接导入它；contracts 不将 Zod 借由 desktop 间接提供。运行时依赖只放入 `dependencies`，构建、类型、测试与 Forge/Vite 工具只放入 `devDependencies`。Task 1 的 desktop manifest 必须设置 `"main": ".vite/build/main.js"`，scripts 保持 `"build": "tsc -p tsconfig.build.json"`，并预先声明 `"start": "electron-forge start"` 与 `"package": "electron-forge package"`；因为 Task 1 只有 TypeScript 骨架，不能让 build 引用 Task 2 才创建的 Vite 配置。

两个 workspace 都必须提供实际的 `lint`、`typecheck`、`test`、`build`、`check` 脚本。pnpm 运行 workspace script 时，其 PATH 包含 root 锁定工具的 binary，但命令 cwd 保持为 package；因此脚本必须直接使用 package 相对路径：`lint` 为 `eslint src tests --max-warnings=0`，`typecheck` 为 `tsc --noEmit -p tsconfig.json`，`test` 为 `vitest run`，`build` 为 `tsc -p tsconfig.build.json`，`check` 顺序运行前四者。不得使用 `pnpm --workspace-root exec`，以免 cwd 错误地变为仓库根。Task 1 必须在 desktop 与 contracts 都创建可编译的最小 `src` 入口和一个断言其公开常量的 Vitest scaffold 测试；所以每个 `src`、`tests` 路径都真实存在，`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 和 `pnpm check` 在仅有骨架时都验证真实源文件、测试或 TypeScript 发射产物，且不会因 filter miss、缺失测试路径或空成功掩盖问题。

`turbo.json` 使用单一任务图：`lint` 声明 `dependsOn: ["^lint"]`，`typecheck` 声明 `dependsOn: ["^typecheck"]`，`test` 声明 `dependsOn: ["^test"]`，`build` 声明 `dependsOn: ["^build"]` 且 Task 1 暂时输出为每个 workspace 的 `dist/**`；`check` 依赖本包的 `lint`、`typecheck`、`test`、`build`，所有非构建任务显式 `outputs: []`。让 `verify:boundaries` 递归读取 `apps/**/src/renderer/**/*.{ts,tsx}` 后逐一调用 `validateSource`；根 `check` 在 Turbo 检查完成后再执行该扫描器，保证边界校验不被遗漏。

- [ ] **Step 4: 生成并冻结依赖锁**

Run: `pnpm install`
Expected: PASS；使用 pnpm `10.33.2` 生成 `pnpm-lock.yaml`，两个 workspace 均被识别。

Run: `pnpm install --frozen-lockfile`
Expected: PASS；锁文件与所有 manifests 一致，不发生 lockfile 更新。

- [ ] **Step 5: 运行 green 与工作区验证**

Run: `node --test scripts/verify-boundaries.test.mjs && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && pnpm check && pnpm verify:boundaries`
Expected: PASS；六类禁止项和负例均通过；每个根命令实际执行两个 workspace 的源文件、scaffold 测试或 TypeScript 发射，命令退出码均为 `0`。

- [ ] **Step 6: 提交 Task 1**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json eslint.config.mjs .prettierrc.json .prettierignore .editorconfig .npmrc .node-version apps/desktop packages/contracts scripts
git commit -m "chore: bootstrap pnpm turbo workspace"
```

### Task 2: contracts 与安全 Electron/React 壳

**Files:**
- Modify: `apps/desktop/package.json`
- Modify: `turbo.json`
- Create: `apps/desktop/forge.config.ts`
- Create: `apps/desktop/vite.main.config.ts`
- Create: `apps/desktop/vite.preload.config.ts`
- Create: `apps/desktop/vite.renderer.config.ts`
- Create: `apps/desktop/forge.env.d.ts`
- Create: `apps/desktop/index.html`
- Create: `apps/desktop/src/main/index.ts`
- Create: `apps/desktop/src/preload/index.ts`
- Create: `apps/desktop/src/renderer/main.tsx`
- Create: `apps/desktop/src/renderer/app.tsx`
- Create: `apps/desktop/tests/preload.test.ts`
- Create: `apps/desktop/tests/main-security.test.ts`
- Create: `apps/desktop/tests/forge-vite-config.test.ts`
- Create: `packages/contracts/src/ipc.ts`

**Interfaces:**
- Consumes: Task 1 的 Node 22.22.2/pnpm workspace、已锁定的 Vite/Forge desktop dependencies 与 `turbo run check`。本任务实现 contracts、Forge Vite 配置和应用源码，并仅将 desktop 的 `build` script 从 Task 1 的 TypeScript 骨架构建改为 `electron-forge package`；不改变已锁定依赖。
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

同时在 `forge-vite-config.test.ts` 写出失败测试：导入 `forge.config.ts` 与三个 `vite.*.config.ts`，断言三个配置模块可加载；断言 `packagerConfig.asar` 为 `true`，Forge plugins 恰为一个 `@electron-forge/plugin-vite` 与一个 `@electron-forge/plugin-fuses`，Vite plugin 的 `concurrent` 为 `false`、其 build entries 分别指向 `src/main/index.ts` 和 `src/preload/index.ts`、renderer entry 为 `{ name: 'main_window', config: 'vite.renderer.config.ts' }`。Forge renderer config 不得包含非法 entry 字段；它依赖 Vite renderer config 默认项目根的 `index.html`，或显式设置 `build.rollupOptions.input` 为该文件。读取 `vite.renderer.config.ts` 的源码并断言它导入 `@vitejs/plugin-react`，而不对 React plugin 的内部对象形状作脆弱断言；断言 fuses 配置关闭 RunAsNode、NodeOptions 与 CliInspect，启用 CookieEncryption、ASAR integrity 与 OnlyLoadAppFromAsar。这些断言固定 Vite 构建、内存控制、ASAR 与 Electron 安全熔丝契约，不测试 Electron 运行时。

- [ ] **Step 2: 运行测试确认 red**

Run: `pnpm --filter @museworks/desktop --fail-if-no-match test -- tests/preload.test.ts tests/forge-vite-config.test.ts`
Expected: FAIL；filter 必须匹配 Task 1 创建的 desktop workspace，测试因 `createMuseworksApi`、Forge Vite 配置或 contracts 实现尚不存在而失败，不得以 `No projects found` 作为 red。

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

使用 Task 1 已建立的 `@museworks/contracts` workspace、TypeScript 配置和 `"@museworks/contracts": "workspace:*"` 依赖。在 `forge.config.ts` 设置 `packagerConfig.asar: true`，并配置唯一的 `@electron-forge/plugin-vite`：`concurrent: false` 控制 main、preload 与 renderer 多 target 构建的峰值内存；main entry 是 `src/main/index.ts` / `vite.main.config.ts`，preload entry 是 `src/preload/index.ts` / `vite.preload.config.ts`，renderer entry 仅为 `{ name: 'main_window', config: 'vite.renderer.config.ts' }`。renderer Vite config 使用默认项目根的 `index.html`，或显式将 `build.rollupOptions.input` 设为该文件；不得向 Forge renderer config 添加 entry 字段。三个 Vite 配置均以 Node 目标处理 main/preload，以 React plugin 处理 renderer；`forge.env.d.ts` 声明 Forge 注入的 renderer Vite server URL 与 name 常量，`main/index.ts` 仅通过这些受类型约束的常量加载 renderer。

同时配置 `@electron-forge/plugin-fuses` 与 `@electron/fuses` 的 V1 options：`RunAsNode: false`、`EnableCookieEncryption: true`、`EnableNodeOptionsEnvironmentVariable: false`、`EnableNodeCliInspectArguments: false`、`EnableEmbeddedAsarIntegrityValidation: true`、`OnlyLoadAppFromAsar: true`。这样 Task 1 声明的 `@electron/fuses` 有实际生产配置路径，且 package smoke 会验证其可由 Forge 使用。不得引入或保留任何 Webpack loader、plugin 或配置。

在 `main/index.ts` 用 `narrowPlatform(value: string): AppInfo['platform']` 与 `narrowArch(value: string): AppInfo['arch']` 显式窄化 `process.platform`、`process.arch`，不受支持的值必须抛错；再由 `ipcMain.handle(IPC_GET_APP_INFO, ...)` 结合 `appInfoSchema` 校验 `app.getVersion()` 与窄化后的值并返回，不能将宽泛的 Node 运行时字符串泄露给 renderer。创建 `BrowserWindow` 时固定 `contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`。renderer 仅调用 `window.museworks.app.getInfo()` 并渲染结果，不调用 HTTP、Node 或环境变量。

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

Run: `pnpm --filter @museworks/desktop --fail-if-no-match test -- tests/preload.test.ts tests/main-security.test.ts tests/forge-vite-config.test.ts`
Expected: PASS；bridge、安全选项和 Forge Vite 配置测试均通过。

Run: `pnpm --filter @museworks/desktop --fail-if-no-match start`
Expected: Vite 开发服务器与安全桌面窗口启动；人工确认 app info 壳页面渲染后关闭窗口，命令以退出码 `0` 结束。

Run: `pnpm --filter @museworks/desktop --fail-if-no-match package`
Expected: Electron Forge 通过 plugin-vite 构建 main、preload 与 renderer 三个 targets，并以退出码 `0` 完成 package；产物不加入 Git。

Run: `node -e "const fs=require('node:fs'); const found=fs.readdirSync('apps/desktop/out',{recursive:true}).some((path)=>path.replaceAll('\\','/').toLowerCase().endsWith('/resources/app.asar')); if (!found) throw new Error('missing packaged resources/app.asar');"`
Expected: PASS；`apps/desktop/out/**/resources/app.asar` 存在，证明 `packagerConfig.asar: true` 生效；归一化并小写化路径后，Windows `resources` 与 macOS `Contents/Resources` 均能匹配。此时将 `apps/desktop/package.json` 的 `build` script 改为 `electron-forge package`，并将 `turbo.json` 的 build outputs 覆盖为 `.vite/**`、`out/**`、`dist/**`，所以随后 root `pnpm build` 通过 Forge 调用 Vite 且不会因遗漏 `.vite` 或 `out` 发生缓存虚假命中。CI 保持 headless，只验证 package 与 `app.asar`；若后续能在受控带显示环境启动已打包可执行文件，再添加可执行启动 smoke，不能以 headless CI 的 package 成功替代它。

- [ ] **Step 5: 提交 Task 2**

```bash
git add apps/desktop packages/contracts turbo.json
git commit -m "feat: add secure desktop bootstrap shell"
```

### Task 3: uv/FastAPI health 服务

**Files:**
- Create: `apps/agent-service/pyproject.toml`
- Create: `apps/agent-service/uv.lock`
- Create: `apps/agent-service/src/museworks_agent/__init__.py`
- Create: `apps/agent-service/src/museworks_agent/main.py`
- Create: `apps/agent-service/tests/test_health.py`

**Interfaces:**
- Consumes: Task 1 的 CI/task naming 约定。
- Produces: `GET /v1/health -> 200`，JSON 严格为 `{status: "ok", service: "museworks-agent", protocolVersion: 1}`。
  本服务不含 `/v1/run`、SSE 或 Ark/ComfyUI 集成。

- [ ] **Step 1: 创建可安装的 Python 项目并同步依赖**

创建 `pyproject.toml`，固定 `requires-python = ">=3.12,<3.13"`，使用 `src` package layout，并在 `[project]` 的 runtime dependencies 声明 FastAPI；在测试 dependency group 声明 pytest 与 httpx，使 `fastapi.testclient.TestClient` 的 HTTP 客户端可用。先创建空的 `src/museworks_agent/__init__.py`，但不要创建 `main.py`。配置与依赖脚手架不属于生产行为，不把这一步当作 TDD red/green 循环。

Run: `uv lock --project apps/agent-service && uv sync --project apps/agent-service --group test`
Expected: PASS；生成 `apps/agent-service/uv.lock`，并安装 Python 3.12、FastAPI、pytest 与 httpx，以便下一步 pytest 能实际加载测试环境。

- [ ] **Step 2: 写出失败的 HTTP 契约测试**

```python
from fastapi.testclient import TestClient
from museworks_agent.main import app

def test_health_returns_versioned_service_contract() -> None:
    response = TestClient(app).get('/v1/health')
    assert response.status_code == 200
    assert response.json() == {'status': 'ok', 'service': 'museworks-agent', 'protocolVersion': 1}
    assert isinstance(response.json()['protocolVersion'], int)
```

- [ ] **Step 3: 运行测试确认 red**

Run: `uv run --project apps/agent-service --group test pytest apps/agent-service/tests/test_health.py -q`
Expected: FAIL，原因是 `museworks_agent.main` 尚不存在。

- [ ] **Step 4: 实现最小 FastAPI app**

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

`HealthResponse` 仅是该 FastAPI 端点的 response model，不导入或镜像 `packages/contracts`。不加入 Ark、Deep Agents、ComfyUI、SSE 或模型依赖。

- [ ] **Step 5: 运行 green 与服务启动检查**

Run: `uv run --project apps/agent-service --group test pytest apps/agent-service/tests/test_health.py -q`
Expected: PASS，`1 passed`。

Run: `uv run --project apps/agent-service --group test python -c "from museworks_agent.main import app; assert any(route.path == '/v1/health' for route in app.routes)"`
Expected: 退出码为 `0`。

- [ ] **Step 6: 提交 Task 3**

```bash
git add apps/agent-service/pyproject.toml apps/agent-service/uv.lock apps/agent-service/src apps/agent-service/tests
git commit -m "feat: add agent health service"
```

### Task 4: CI、文档与全量验证

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `scripts/ci-workflow.test.mjs`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/architecture/system-overview.md`
- Modify: `docs/architecture/development-workflow.md`

**Interfaces:**
- Consumes: Task 1 的 `pnpm verify:boundaries`，Task 2 的 desktop test 命令，Task 3 的 `uv run --project apps/agent-service --group test pytest`。
- Produces: 对 pull request 和 main push 在 Windows x64 与 macOS arm64 上执行 Node 22.22.2/pnpm 10.33.2 与 Python 3.12 验证、并原生运行 Electron Forge package smoke 的 GitHub Actions；README 仅描述当前 bootstrap 能力和非目标。

- [ ] **Step 1: 写出失败的 CI 配置静态测试**

```js
import fs from 'node:fs';
import assert from 'node:assert/strict';

const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
assert.match(workflow, /node-version: 22\.22\.2/);
assert.match(workflow, /python-version: '3\.12'/);
assert.match(workflow, /pnpm verify:boundaries/);
assert.match(workflow, /windows-2025/);
assert.match(workflow, /macos-15/);
assert.match(workflow, /arch:\s*x64/);
assert.match(workflow, /arch:\s*arm64/);
assert.match(workflow, /pnpm --filter @museworks\/desktop --fail-if-no-match package/);
assert.match(workflow, /resources\/app\.asar/);
assert.doesNotMatch(workflow, /upload-artifact|release|publish/);
```

- [ ] **Step 2: 运行测试确认 red**

Run: `node --test scripts/ci-workflow.test.mjs`
Expected: FAIL，原因是 `.github/workflows/ci.yml` 尚不存在。

- [ ] **Step 3: 最小实现 CI 与范围准确的文档**

```yaml
strategy:
  fail-fast: false
  matrix:
    include:
      - runner: windows-2025
        arch: x64
      - runner: macos-15
        arch: arm64
runs-on: ${{ matrix.runner }}
```

Task 4 在创建 `.github/workflows/ci.yml` 后，将 root `format:check` 更新为下列明确命令；它覆盖机器维护的 root dot-config 与 workflow，但继续不检查治理 Markdown：

```json
"format:check": "prettier --check package.json pnpm-workspace.yaml turbo.json tsconfig.json eslint.config.mjs .prettierrc.json apps packages scripts .github/workflows"
```

这个单一 matrix job 的每个原生 OS 上都执行 `actions/setup-node@v4`（Node `22.22.2`）、`corepack enable`、`corepack prepare pnpm@10.33.2 --activate`、`pnpm install --frozen-lockfile`、`pnpm lint`、`pnpm format:check`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm check` 与 `pnpm verify:boundaries`；再执行 `actions/setup-python@v5`（Python `3.12`）、`astral-sh/setup-uv@v7` 和 `uv run --project apps/agent-service --group test pytest apps/agent-service/tests -q`。在 package 前用 Node 断言 `process.arch` 等于 `${{ matrix.arch }}`，然后执行 `pnpm --filter @museworks/desktop --fail-if-no-match package` 以及 Task 2 的 `out/**/resources/app.asar` Node 断言。该 Forge package smoke 必须分别在 Windows x64 和 macOS arm64 runner 上原生完成；CI 不得包含 `upload-artifact`、签名、release 或 publish 步骤，生成物仅在 job 生命周期内使用。README 与架构文档必须说明当前仅有 app-info/health 骨架，未提供生成、Ark、ComfyUI 或 SSE run 能力。

```yaml
- run: node -e "if (process.arch !== '${{ matrix.arch }}') { throw new Error('unexpected architecture: ' + process.arch); }"
- run: pnpm --filter @museworks/desktop --fail-if-no-match package
```

- [ ] **Step 4: 运行全量 green 验证**

Run: `pnpm install --frozen-lockfile && node --test scripts/ci-workflow.test.mjs scripts/verify-boundaries.test.mjs && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && pnpm check && pnpm verify:boundaries && pnpm --filter @museworks/desktop --fail-if-no-match package && node -e "const fs=require('node:fs'); const found=fs.readdirSync('apps/desktop/out',{recursive:true}).some((path)=>path.replaceAll('\\','/').toLowerCase().endsWith('/resources/app.asar')); if (!found) throw new Error('missing packaged resources/app.asar');" && uv run --project apps/agent-service --group test pytest apps/agent-service/tests -q`
Expected: 本机 Windows 的命令退出码均为 `0`，无失败测试。该本机命令只验证 workflow 静态契约和 Windows x64 package，不能替代 macOS arm64 原生执行。

- [ ] **Step 5: 提交 Task 4**

```bash
git add package.json .github/workflows/ci.yml README.md docs/architecture scripts/ci-workflow.test.mjs
git commit -m "ci: verify bootstrap boundaries"
```

## Final Verification and Review

- [ ] 运行 `pnpm install --frozen-lockfile`；预期 lockfile 不变化且两个 Node workspace 被识别。
- [ ] 运行 `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && pnpm check && pnpm verify:boundaries`；预期根级工具链、Turbo 任务图、scaffold 测试、构建和 TypeScript AST 边界扫描均以退出码 `0` 完成。
- [ ] 在本机 Windows x64 运行 `pnpm --filter @museworks/desktop --fail-if-no-match start`；人工确认 Vite 开发服务器、受 sandbox 保护的桌面窗口和 app-info 壳页面均可用后关闭窗口，预期退出码为 `0`。
- [ ] 在本机 Windows x64 运行 `pnpm --filter @museworks/desktop --fail-if-no-match build && pnpm --filter @museworks/desktop --fail-if-no-match package`，再运行 Task 2 的 `apps/desktop/out` 路径归一化 ASAR Node 断言；预期 Vite main/preload/renderer targets、Electron Forge package smoke 与 ASAR 检查均以退出码 `0` 完成，产物不纳入 Git。
- [ ] 运行 `uv run --project apps/agent-service --group test pytest apps/agent-service/tests -q`；预期 health 契约测试通过。
- [ ] 运行 `node --test scripts/ci-workflow.test.mjs scripts/verify-boundaries.test.mjs`；预期 CI matrix、禁止发布约束与边界 AST 测试均通过。
- [ ] 真正的合并与跨平台完成门禁是 GitHub Actions 的 `windows-2025` / `x64` 与 `macos-15` / `arm64` matrix jobs 实际成功，且两个 job 都完成 Node、Python 与原生 Forge package smoke；仅有 workflow 静态测试或本机 Windows package 时，不得宣称跨平台完成。
- [ ] 仓库没有有效 `origin` 时，记录“macOS arm64 CI 未验证”，本地只运行 workflow 静态契约和 Windows x64 package；接入远程后立即触发并检查上述 matrix jobs，补齐该门禁后才能移除未验证记录。
- [ ] 运行 `git diff --check`；预期退出码为 `0`。
- [ ] 运行 `git status --short`；在提交后预期工作树为空，不含 `.superpowers/`、依赖、模型、凭据和构建物。
- [ ] 逐项复查 `## Global Constraints`：版本、IPC、health 契约、SSE-only、密钥和 RTX 3060 Ti 8GB VRAM 表述均由对应任务覆盖。
- [ ] 在合并前安排独立审查，确认没有引入 run、流式、Ark、Deep Agents、ComfyUI、模型下载或签名实现。
