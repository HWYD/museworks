# Museworks Windows uv 启动兜底实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让已安装于 Windows 官方默认目录、但尚未进入当前终端 `PATH` 的 uv 仍可被 `pnpm dev`、`dev:agent`、agent 测试和检查可靠启动，并消除 Turbo 的次生非 UTF-8 控制台错误。

**Architecture:** 在仓库 `scripts/` 中增加一个无第三方依赖的 Node 启动器，先解析 `PATH` 中的 uv，再回退到 Windows `%USERPROFILE%\.local\bin\uv.exe`，最后以稳定 UTF-8 错误失败。`@museworks/agent-service` 的四个脚本统一经过该启动器；Turbo 仍是唯一全栈开发进程编排器，Electron Main 生命周期不变。

**Tech Stack:** Node.js 22.22.2、pnpm 10.33.2、Turbo 2.2.3、uv 0.11.32、Node test runner、PowerShell、Electron Forge + Vite、FastAPI/Uvicorn

## Global Constraints

- 固定使用 Node 22.22.2、pnpm 10.33.2、Turbo 2.2.3 与 uv 0.11.32；不得升级工具链或改变 lockfile 依赖解析。
- `PATH` 中的 uv 必须优先；仅 Windows 回退 `%USERPROFILE%\.local\bin\uv.exe`，macOS/Linux 不猜测额外安装目录。
- 启动器不得使用 shell、`where.exe`、`which`、命令字符串拼接、联网、下载、安装、重试或全局环境写入。
- agent 的 `dev`、`start`、`test`、`check` 必须统一经过同一启动器并保留原 uv 参数。
- Turbo 继续同时持有 Electron 与 FastAPI 的持久任务；不得引入第二个进程管理器、`--parallel` 或启动顺序。
- Electron Main 不得启动、等待、探测或管理 FastAPI；不得修改 Renderer、Preload、IPC、HTTP、SSE、模型或 sidecar 运行时。
- 找不到 uv 时必须使用 Node 输出稳定 UTF-8、可操作错误并退出非零，不得泄露环境变量或完整用户路径列表。
- 生产行为变更必须遵循 RED → GREEN；L2 变更必须有真实运行时验证和独立审查。

---

### Task 1：实现并验证跨平台 uv 启动器

**Files:**

- Create: `scripts/run-uv.mjs`
- Create: `scripts/run-uv.test.mjs`
- Modify: `scripts/workspace-config.test.mjs`
- Modify: `apps/agent-service/package.json`
- Modify: `README.md`
- Modify: `docs/architecture/development-workflow.md`

**Interfaces:**

- Consumes: `process.platform`、`process.env.PATH`、`process.env.USERPROFILE`、uv 0.11.32 CLI 参数与现有 `@museworks/agent-service` 四个 package scripts。
- Produces: `resolveUvExecutable(options): string | null`；CLI `node scripts/run-uv.mjs <uv args...>`；四个 agent scripts 统一的 uv 解析、参数转发、退出码和错误语义。

- [ ] **Step 1: 写入解析器和 workspace 契约的失败测试**

在 `scripts/run-uv.test.mjs` 使用 Node test runner 导入尚不存在的 `resolveUvExecutable` 与 `uvNotFoundMessage`，并写入以下行为测试：

```js
import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveUvExecutable, uvNotFoundMessage } from './run-uv.mjs';

test('prefers the PATH uv executable over the Windows fallback', () => {
  const pathUv = 'C:\\tools\\uv.exe';
  const fallbackUv = 'C:\\Users\\dev\\.local\\bin\\uv.exe';
  const executablePaths = new Set([pathUv, fallbackUv]);

  assert.equal(
    resolveUvExecutable({
      platform: 'win32',
      env: { PATH: 'C:\\tools', USERPROFILE: 'C:\\Users\\dev' },
      isExecutable: (candidate) => executablePaths.has(candidate),
    }),
    pathUv,
  );
});

test('falls back to the official Windows user executable directory', () => {
  const fallbackUv = 'C:\\Users\\dev\\.local\\bin\\uv.exe';

  assert.equal(
    resolveUvExecutable({
      platform: 'win32',
      env: { PATH: 'C:\\missing', USERPROFILE: 'C:\\Users\\dev' },
      isExecutable: (candidate) => candidate === fallbackUv,
    }),
    fallbackUv,
  );
});

test('does not invent a fallback outside Windows', () => {
  assert.equal(
    resolveUvExecutable({
      platform: 'darwin',
      env: { PATH: '/missing', HOME: '/Users/dev' },
      isExecutable: () => false,
    }),
    null,
  );
});

test('ignores empty PATH entries and relative Windows user profiles', () => {
  assert.equal(
    resolveUvExecutable({
      platform: 'win32',
      env: { PATH: ';;', USERPROFILE: 'relative-profile' },
      isExecutable: () => true,
    }),
    null,
  );
});

test('returns an actionable UTF-8-safe error without dumping PATH', () => {
  const message = uvNotFoundMessage({ platform: 'win32' });

  assert.match(message, /uv 0\.11\.32/);
  assert.match(message, /https:\/\/docs\.astral\.sh\/uv\/getting-started\/installation\//);
  assert.match(message, /%USERPROFILE%\\\.local\\bin\\uv\.exe/);
  assert.doesNotMatch(message, /PATH=/);
});
```

在 `scripts/workspace-config.test.mjs` 把现有 agent script 期望改为：

```js
assert.deepEqual(agentManifest.scripts, {
  dev: 'node ../../scripts/run-uv.mjs run --locked museworks-agent --reload',
  start: 'node ../../scripts/run-uv.mjs run --locked museworks-agent',
  test: 'node ../../scripts/run-uv.mjs run --group test --locked pytest tests -q',
  check: 'node ../../scripts/run-uv.mjs lock --check',
});
```

变异检查：删除 PATH 优先分支、删除 Windows fallback、接受相对 `USERPROFILE`、把任一 agent script 改回裸 `uv`，都必须至少让一个测试失败。

- [ ] **Step 2: 运行聚焦测试并确认 RED**

Run:

```powershell
node --test scripts/run-uv.test.mjs scripts/workspace-config.test.mjs
```

Expected: FAIL；`scripts/run-uv.mjs` 尚不存在导致 `ERR_MODULE_NOT_FOUND`，且 workspace 契约仍看到四个裸 `uv` 脚本。不得把语法错误或夹具错误当作 RED。

- [ ] **Step 3: 写入最小 uv 解析与启动实现**

在 `scripts/run-uv.mjs` 实现以下公开接口和 CLI 行为：

```js
import { accessSync, constants, statSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const UV_VERSION = '0.11.32';

const isExecutableFile = (candidate) => {
  try {
    if (!statSync(candidate).isFile()) return false;
    accessSync(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

export function resolveUvExecutable({
  platform = process.platform,
  env = process.env,
  isExecutable = isExecutableFile,
} = {}) {
  const delimiter = platform === 'win32' ? ';' : ':';
  const executableName = platform === 'win32' ? 'uv.exe' : 'uv';
  const pathEntries = (env.PATH ?? '')
    .split(delimiter)
    .map((entry) => entry.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);

  for (const entry of pathEntries) {
    const candidate = resolve(entry, executableName);
    if (isExecutable(candidate)) return candidate;
  }

  if (platform === 'win32' && env.USERPROFILE && isAbsolute(env.USERPROFILE)) {
    const fallback = join(env.USERPROFILE, '.local', 'bin', 'uv.exe');
    if (isExecutable(fallback)) return fallback;
  }

  return null;
}

export function uvNotFoundMessage({ platform = process.platform } = {}) {
  const windowsHint =
    platform === 'win32' ? ' Expected Windows fallback: %USERPROFILE%\\.local\\bin\\uv.exe.' : '';
  return `Museworks could not find uv ${UV_VERSION}.${windowsHint} Install it from https://docs.astral.sh/uv/getting-started/installation/ and reopen the terminal or repair PATH.`;
}

export function main(args = process.argv.slice(2)) {
  const executable = resolveUvExecutable();
  if (!executable) {
    console.error(uvNotFoundMessage());
    return 1;
  }

  const result = spawnSync(executable, args, {
    cwd: process.cwd(),
    env: process.env,
    shell: false,
    stdio: 'inherit',
  });
  if (result.error) {
    console.error(`Museworks failed to start uv ${UV_VERSION}: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main();
}
```

实现时允许为 Windows 路径大小写与 `process.argv[1]` 缺失做必要的最小防御，但不得增加环境覆盖变量、自动安装或 shell fallback。

把 `apps/agent-service/package.json` 的四个脚本替换为 Step 1 中的精确字符串。不得修改根 `dev`、Turbo `persistent/cache`、Electron package 或 lockfile。

- [ ] **Step 4: 运行聚焦测试并确认 GREEN**

Run:

```powershell
node --test scripts/run-uv.test.mjs scripts/workspace-config.test.mjs
```

Expected: PASS；所有 uv 解析测试与既有 workspace 配置测试通过。

- [ ] **Step 5: 验证真实 uv fallback 和失败错误**

在 PowerShell 子进程环境中保存原 PATH，然后移除大小写不敏感匹配 `%USERPROFILE%\.local\bin` 的条目，不修改用户或系统环境。运行：

```powershell
node scripts/run-uv.mjs --version
```

Expected: exit 0，stdout 精确包含 `uv 0.11.32`。

再使用 Node 测试覆盖的空 PATH/无绝对 `USERPROFILE` 场景验证 `uvNotFoundMessage()`；不得重命名或移动用户真实 `uv.exe` 来制造失败。

- [ ] **Step 6: 更新当前行为文档**

在 `README.md` 与 `docs/architecture/development-workflow.md` 写明：

- uv 0.11.32 仍是预安装前提；项目不下载或升级 uv。
- Windows 会在 `PATH` 缺失时检查 `%USERPROFILE%\.local\bin\uv.exe`。
- WinGet、Scoop、CI 或自定义目录仍通过 `PATH` 优先解析。
- 找不到 uv 时会给出可操作错误；不再要求每个根 pnpm 命令前由当前 shell 直接运行 `uv --version`。

不得改写当前功能范围、FastAPI 路由、Electron Main 非管理语义或 macOS 未验证说明。

- [ ] **Step 7: 执行真实后端与全栈 smoke**

在仅对本次子进程移除 `%USERPROFILE%\.local\bin` 的 PATH 下：

1. 启动 `pnpm dev:agent`，以条件轮询等待 `http://127.0.0.1:8765/v1/health`，严格验证 `{"status":"ok","service":"museworks-agent","protocolVersion":1}`。
2. 记录根 PID 及递归后代的 PID、ParentProcessId、CreationDate、ExecutablePath、CommandLine；只对同一 PID+CreationDate 身份执行精确终止，确认 survivor=0 和 8765 listener=0。
3. 启动根 `pnpm dev`，确认同一次任务图中 agent 与 desktop 两个 `dev` 任务均启动；严格验证 health，并确认真实 Electron 窗口标题 `Museworks`、窗口可响应、UI 包含 `Museworks 0.0.0` 与 `win32 · x64`。
4. 关闭窗口后精确终止本次根 PID 后代，再次确认 survivor=0、8765 listener=0；禁止 `taskkill /IM`、按名称 kill、通配 Node/Python kill 或影响 worktree 外进程。

stdout/stderr、身份表和截图只写入 `.superpowers/` ignored workspace，不提交运行产物。若截图全黑，必须用 UI Automation 原始输出与可读的新截图补证后才算通过。

- [ ] **Step 8: 执行全量验证**

Run:

```powershell
pnpm install --frozen-lockfile
node --test scripts/*.test.mjs
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm check
pnpm verify:boundaries
pnpm verify:skills
pnpm --filter @museworks/desktop --fail-if-no-match package
node scripts/verify-packaged-asar.mjs
git diff --check
git status --short
```

Expected: 全部 exit 0；Node tests 包含新 uv launcher 测试，pytest 仍为 locked 执行，Windows x64 package 与 ASAR 验证通过，git status 只包含本任务预期文件。

- [ ] **Step 9: 自审、提交并请求独立 L2 审查**

自审 diff，确认：

- 无 shell、联网、下载、工具升级、lockfile 漂移或全局 PATH 修改；
- Windows fallback 只接受绝对 `USERPROFILE`，错误不输出 PATH 或秘密；
- 四个 agent scripts 统一，根 Turbo 与 Electron Main 无改动；
- 测试确有 RED → GREEN，真实无 PATH smoke 有完整清理证据。

Commit:

```powershell
git add scripts/run-uv.mjs scripts/run-uv.test.mjs scripts/workspace-config.test.mjs apps/agent-service/package.json README.md docs/architecture/development-workflow.md
git commit -m "fix: resolve uv for Windows development"
```

随后对本任务 BASE..HEAD 生成 review package，交给独立 reviewer 检查规格符合性、任务质量、安全边界、跨平台路径、退出码、Ctrl+C/进程清理与测试证据；Critical/Important 必须进入原实现子代理修复和 scoped re-review。
