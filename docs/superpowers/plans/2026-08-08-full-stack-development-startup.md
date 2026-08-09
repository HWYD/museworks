# 全栈开发启动实施计划

> **面向 Agent 执行者：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，逐任务执行本计划。步骤使用 checkbox（`- [ ]`）跟踪。

**目标：** 让 `pnpm dev` 通过 Turbo 同时启动 Electron Forge + Vite 桌面端和 FastAPI/Uvicorn 服务，并保留可独立启动桌面端或后端的开发命令。

**架构：** 为 Python 包添加真实的 Uvicorn 命令行入口，再通过私有 workspace 桥接包将 Python 任务接入 pnpm/Turbo。Turbo 持有两个开发进程，不设置启动顺序或就绪检查；本阶段 Electron Main 保持不变，不管理、启动或探测 FastAPI。

**技术栈：** Node 22.22.2、pnpm 10.33.2、Turbo 2.2.3、Electron 43.2.0、Electron Forge 7.11.2、Vite 7.3.6、Python 3.12、uv 0.11.32、FastAPI 0.116.x、Uvicorn、pytest 8.4.x、Node test runner、GitHub Actions。

## 全局约束

- 在现有 linked worktree `D:\code\mine\museworks\.worktrees\project-bootstrap` 中工作；不得再创建嵌套 worktree。
- 保持仓库已锁定的 Node、pnpm、Turbo、Electron、Forge、Vite、React、FastAPI 与 Vitest 精确版本不变。
- 只添加服务现有 FastAPI app 所需的 Uvicorn 运行时依赖；不得添加第二套进程管理器或 `concurrently`。
- `pnpm dev` 必须使用不带 `--parallel` 的 `turbo run dev`；两个包任务都必须是 persistent 且不缓存。
- Turbo 是两个开发进程的唯一所有者。本阶段 Electron Main 不得 spawn、stop、health-check、等待或连接 FastAPI。
- FastAPI 只能监听 `127.0.0.1`；默认端口是 `8765`，仅允许 `MUSEWORKS_AGENT_PORT` 以 `1..65535` 的 ASCII 十进制值覆盖。
- 严格保持 `/v1/health`，并让 `/v1/run` 继续不可用。不得增加 SSE、NDJSON、Ark、Deep Agents、ComfyUI、模型、IPC 或 Renderer HTTP 行为。
- Python workspace 桥接包不得声明不存在的 `lint`、`typecheck` 或 `build` 门禁；只提供 `dev`、`start`、`test` 与 `check`。
- 保持 CI 只读权限、现有原生 Windows x64/macOS arm64 matrix，不添加上传、发布、release、签名或 secrets。
- 每项生产行为变更均遵循 RED → GREEN。纯文档变更使用可读性、格式检查与 `git diff --check`，不添加脆弱的内容测试。
- 每个实现任务完成后都要独立审查；完整 L2 变更交付前还必须通过最终独立代码审查。

## 文件映射

- 新建 `apps/agent-service/src/museworks_agent/cli.py`：校验运行时配置并为现有 FastAPI app 调用 Uvicorn。
- 新建 `apps/agent-service/tests/test_cli.py`：单测 Python 入口、loopback host、reload flag、默认/覆盖端口和非法端口失败。
- 修改 `apps/agent-service/pyproject.toml`：添加 Uvicorn 与 `museworks-agent` 命令行入口。
- 修改 `apps/agent-service/uv.lock`：锁定新增运行时依赖。
- 新建 `apps/agent-service/package.json`：为 Python 的 `dev`、`start`、`test`、`check` 提供私有 pnpm/Turbo bridge。
- 新建 `apps/agent-service/turbo.json`：将 `MUSEWORKS_AGENT_PORT` 作用域限定为 agent-service 的 `dev` 任务。
- 修改 `apps/desktop/package.json`：添加与现有 Forge `start` 一致的 `dev`，同时保留 `start`。
- 修改 `package.json`：添加根全栈与过滤后的开发命令，并将新 workspace JSON 纳入格式检查。
- 修改 `turbo.json`：声明不缓存的 persistent `dev` 任务。
- 修改 `pnpm-lock.yaml`：注册新 workspace importer，不添加 Node 运行时依赖。
- 修改 `scripts/workspace-config.test.mjs`：契约测试全部 root/package/Turbo 开发命令和任务边界。
- 修改 `scripts/ci-workflow.test.mjs`：要求 Python/uv setup 位于 Turbo 测试前，并禁止已重复的独立 pytest step。
- 修改 `.github/workflows/ci.yml`：在根 Turbo gates 前安装/同步 Python，让 `pnpm test` 负责 pytest 执行。
- 修改 `README.md`：记录 `pnpm dev`、独立命令、默认地址和当前范围。
- 修改 `docs/architecture/system-overview.md`：记录 Turbo 持有开发进程，Main 不管理服务生命周期。
- 修改 `docs/architecture/development-workflow.md`：记录安装、启动、关闭和验证命令。

---

### Task 1：添加可执行的 FastAPI 服务入口

**文件：**

- 新建：`apps/agent-service/src/museworks_agent/cli.py`
- 新建：`apps/agent-service/tests/test_cli.py`
- 修改：`apps/agent-service/pyproject.toml`
- 修改：`apps/agent-service/uv.lock`

**接口：**

- 消费：`museworks_agent.main:app`、既有 `/v1/health` 契约、Python 3.12 与 uv 0.11.32。
- 产出：`parse_port(value: str | None) -> int`、`main(argv: Sequence[str] | None = None) -> None`，以及 console command `museworks-agent [--reload]`。
- 运行时常量：`HOST = "127.0.0.1"`、`DEFAULT_PORT = 8765`、`PORT_ENV = "MUSEWORKS_AGENT_PORT"`。

- [ ] **步骤 1：编写失败的 CLI 测试**

创建 `apps/agent-service/tests/test_cli.py`，包含以下可观察契约：

```python
import pytest

from museworks_agent import cli


def test_parse_port_uses_the_safe_default() -> None:
    assert cli.parse_port(None) == 8765


@pytest.mark.parametrize("value", ["1", "8765", "65535"])
def test_parse_port_accepts_ascii_decimal_ports(value: str) -> None:
    assert cli.parse_port(value) == int(value)


@pytest.mark.parametrize("value", ["", "0", "65536", "1.5", " 8765", "１２３"])
def test_parse_port_rejects_invalid_values(value: str) -> None:
    with pytest.raises(ValueError, match="MUSEWORKS_AGENT_PORT"):
        cli.parse_port(value)


def test_main_runs_the_existing_app_on_loopback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[tuple[str, dict[str, object]]] = []

    def fake_run(app_path: str, **options: object) -> None:
        calls.append((app_path, options))

    monkeypatch.setenv("MUSEWORKS_AGENT_PORT", "9001")
    monkeypatch.setattr(cli.uvicorn, "run", fake_run)

    cli.main(["--reload"])

    assert calls == [
        (
            "museworks_agent.main:app",
            {"host": "127.0.0.1", "port": 9001, "reload": True},
        )
    ]


def test_main_exits_nonzero_for_an_invalid_environment_port(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MUSEWORKS_AGENT_PORT", "65536")

    with pytest.raises(SystemExit) as error:
        cli.main([])

    assert error.value.code == 2
```

- [ ] **步骤 2：运行聚焦测试并记录 RED**

运行：

```powershell
uv run --project apps/agent-service --group test --locked pytest apps/agent-service/tests/test_cli.py -q
```

预期：在收集测试时因 `museworks_agent.cli` 不存在而 FAIL。不得弱化 import 或跳过该测试。

- [ ] **步骤 3：添加并锁定运行时依赖与命令行入口**

更新 `apps/agent-service/pyproject.toml`，使 project section 包含既有 FastAPI constraint、Uvicorn 和明确的 console script：

```toml
[project]
name = "museworks-agent"
version = "0.1.0"
description = "Local Museworks agent service"
requires-python = ">=3.12,<3.13"
dependencies = ["fastapi>=0.116,<0.117", "uvicorn>=0.35,<0.36"]

[project.scripts]
museworks-agent = "museworks_agent.cli:main"
```

重新生成并同步锁定环境：

```powershell
uv lock --project apps/agent-service
uv sync --project apps/agent-service --group test --locked
```

预期：两个命令均 PASS；`uv.lock` 包含 Uvicorn，且 FastAPI 继续解析到 `>=0.116,<0.117` 范围内。

- [ ] **步骤 4：实现最小、可校验的 CLI**

创建 `apps/agent-service/src/museworks_agent/cli.py`：

```python
from __future__ import annotations

import argparse
import os
from collections.abc import Sequence

import uvicorn

HOST = "127.0.0.1"
DEFAULT_PORT = 8765
PORT_ENV = "MUSEWORKS_AGENT_PORT"


def parse_port(value: str | None) -> int:
    if value is None:
        return DEFAULT_PORT
    if not value.isascii() or not value.isdecimal():
        raise ValueError(f"{PORT_ENV} must be an ASCII decimal port in 1..65535")
    port = int(value)
    if not 1 <= port <= 65535:
        raise ValueError(f"{PORT_ENV} must be an ASCII decimal port in 1..65535")
    return port


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="museworks-agent")
    parser.add_argument("--reload", action="store_true")
    arguments = parser.parse_args(argv)

    try:
        port = parse_port(os.environ.get(PORT_ENV))
    except ValueError as error:
        parser.error(str(error))

    uvicorn.run(
        "museworks_agent.main:app",
        host=HOST,
        port=port,
        reload=arguments.reload,
    )


if __name__ == "__main__":
    main()
```

不得添加可配置 host、shell execution、health wait、credential handling，或第二个 FastAPI app。

- [ ] **步骤 5：运行 CLI 测试并记录 GREEN**

运行：

```powershell
uv run --project apps/agent-service --group test --locked pytest apps/agent-service/tests/test_cli.py -q
```

预期：全部 CLI 测试 PASS，且没有未知命令行入口警告。

- [ ] **步骤 6：重跑完整 Python 契约测试**

运行：

```powershell
uv run --project apps/agent-service --group test --locked pytest apps/agent-service/tests -q
uv lock --project apps/agent-service --check
git diff --check
```

预期：CLI 测试和两个既有 health 测试均 PASS；`/v1/run` 继续为 404；lock check 与 diff check 均 PASS。

- [ ] **步骤 7：提交可执行服务入口**

```powershell
git add apps/agent-service/pyproject.toml apps/agent-service/uv.lock apps/agent-service/src/museworks_agent/cli.py apps/agent-service/tests/test_cli.py
git commit -m "feat: add agent service entrypoint"
```

进入任务 2 前请求独立审查。本任务 reviewer 必须特别检查 loopback-only binding、ASCII/range validation、reload isolation、没有 `/v1/run`，以及没有 credential path。

---

### Task 2：将 Python 开发任务接入 pnpm 与 Turbo

**文件：**

- 新建：`apps/agent-service/package.json`
- 新建：`apps/agent-service/turbo.json`
- 修改：`apps/desktop/package.json`
- 修改：`package.json`
- 修改：`turbo.json`
- 修改：`pnpm-lock.yaml`
- 修改：`scripts/workspace-config.test.mjs`
- 修改：`scripts/ci-workflow.test.mjs`
- 修改：`.github/workflows/ci.yml`

**接口：**

- 消费：任务 1 的 console command `museworks-agent [--reload]` 与现有 desktop Forge `start` command。
- 产出：根 `pnpm dev`、`pnpm dev:agent` 和 `pnpm dev:desktop`；Turbo tasks `@museworks/agent-service#dev` 与 `@museworks/desktop#dev`。
- Python bridge scripts：`dev`、`start`、`test`、`check`；不得有 `lint`、`typecheck` 或 `build`。

- [ ] **步骤 1：添加失败的 workspace 与 CI 编排断言**

扩展 `scripts/workspace-config.test.mjs`，添加一个读取 `apps/agent-service/package.json`、`apps/agent-service/turbo.json`、desktop manifest、root manifest 与 root `turbo.json` 的测试，断言：

```js
test('defines Turbo-owned full-stack development entrypoints', () => {
  const rootManifest = JSON.parse(readText('package.json'));
  const rootTurbo = JSON.parse(readText('turbo.json'));
  const desktopManifest = JSON.parse(readText('apps/desktop/package.json'));
  const agentManifest = JSON.parse(readText('apps/agent-service/package.json'));
  const agentTurbo = JSON.parse(readText('apps/agent-service/turbo.json'));

  assert.equal(rootManifest.scripts.dev, 'turbo run dev');
  assert.equal(
    rootManifest.scripts['dev:agent'],
    'turbo run dev --filter=@museworks/agent-service',
  );
  assert.equal(rootManifest.scripts['dev:desktop'], 'turbo run dev --filter=@museworks/desktop');
  assert.deepEqual(rootTurbo.tasks.dev, { cache: false, persistent: true });
  assert.equal(desktopManifest.scripts.dev, desktopManifest.scripts.start);
  assert.deepEqual(agentManifest.scripts, {
    dev: 'uv run --locked museworks-agent --reload',
    start: 'uv run --locked museworks-agent',
    test: 'uv run --group test --locked pytest tests -q',
    check: 'uv lock --check',
  });
  assert.equal(agentManifest.private, true);
  assert.deepEqual(agentTurbo, {
    extends: ['//'],
    tasks: { dev: { env: ['MUSEWORKS_AGENT_PORT'] } },
  });
  for (const forbidden of ['lint', 'typecheck', 'build']) {
    assert.equal(agentManifest.scripts[forbidden], undefined);
  }
});
```

更新既有精确 `format:check` 断言：期望 `"apps/**/*.{json,ts,tsx,css,html}"`，替换 desktop-only glob。

扩展 `scripts/ci-workflow.test.mjs`，断言 `Set up Python`、`Set up uv`、`Sync Python dependencies` steps 位于根 `pnpm test` 前，且 workflow 不再直接调用 pytest：

```js
const pythonSetup = workflow.indexOf('- name: Set up Python');
const uvSetup = workflow.indexOf('- name: Set up uv');
const pythonSync = workflow.indexOf('- name: Sync Python dependencies');
const turboTest = workflow.indexOf('run: pnpm test');

assert.ok(pythonSetup > 0 && pythonSetup < turboTest);
assert.ok(uvSetup > pythonSetup && uvSetup < turboTest);
assert.ok(pythonSync > uvSetup && pythonSync < turboTest);
assert.doesNotMatch(workflow, /uv run .*pytest/);
```

保留对精确 action majors、uv 0.11.32、Python 3.12、permissions、native matrix、package 与 ASAR 的既有断言。

- [ ] **步骤 2：运行编排测试并记录 RED**

运行：

```powershell
node --test scripts/workspace-config.test.mjs scripts/ci-workflow.test.mjs
```

预期：FAIL，因为 `apps/agent-service/package.json`、`turbo.json` 不存在，root/desktop `dev` scripts 缺失，且 Python setup 当前位于 `pnpm test` 后。

- [ ] **步骤 3：添加精确的 workspace 桥接与 Turbo 任务配置**

创建 `apps/agent-service/package.json`：

```json
{
  "name": "@museworks/agent-service",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "uv run --locked museworks-agent --reload",
    "start": "uv run --locked museworks-agent",
    "test": "uv run --group test --locked pytest tests -q",
    "check": "uv lock --check"
  }
}
```

创建 `apps/agent-service/turbo.json`：

```json
{
  "extends": ["//"],
  "tasks": {
    "dev": {
      "env": ["MUSEWORKS_AGENT_PORT"]
    }
  }
}
```

向 `turbo.json` 添加以下 root task，不修改既有 task definitions：

```json
"dev": {
  "cache": false,
  "persistent": true
}
```

在 root scripts 的既有 gates 前添加：

```json
"dev": "turbo run dev",
"dev:agent": "turbo run dev --filter=@museworks/agent-service",
"dev:desktop": "turbo run dev --filter=@museworks/desktop"
```

将 root formatting glob 从 `apps/desktop/**/*.{json,ts,tsx,css,html}` 改为 `apps/**/*.{json,ts,tsx,css,html}`，以覆盖新 JSON manifests。

在 `apps/desktop/package.json` 中添加：

```json
"dev": "node ../../node_modules/@electron-forge/cli/dist/electron-forge.js start"
```

保留 `start` 的相同值以保持兼容。不得修改 hoisted root Forge CLI path，也不得将 Forge CLI 加入 desktop package。

- [ ] **步骤 4：在 CI 中将 Python setup 前移到 Turbo gates 前**

在 `.github/workflows/ci.yml` 中，将既有 `Set up Python`、`Set up uv`、`Sync Python dependencies` steps 移至 `Install Node dependencies` 后。将 `Test Node workspaces` 重命名为 `Test workspaces`。仅删除独立的 `Test agent service` step，因为 `pnpm test` 现在通过 Turbo 到达 agent workspace。

workflow 中间部分必须是：

```yaml
- name: Install Node dependencies
  run: pnpm install --frozen-lockfile

- name: Set up Python
  uses: actions/setup-python@v6
  with:
    python-version: '3.12'

- name: Set up uv
  uses: astral-sh/setup-uv@v9
  with:
    version: '0.11.32'

- name: Sync Python dependencies
  run: uv sync --project apps/agent-service --group test --locked

- name: Lint
  run: pnpm lint

- name: Check formatting
  run: pnpm format:check

- name: Typecheck
  run: pnpm typecheck

- name: Test workspaces
  run: pnpm test
```

不得修改 workflow matrix、permissions、package、ASAR，或 release behavior 禁止规则。

- [ ] **步骤 5：刷新 pnpm workspace lock 并验证 frozen installation**

运行：

```powershell
pnpm install
pnpm install --frozen-lockfile
```

预期：均 PASS；`pnpm-lock.yaml` 新增 `apps/agent-service` importer，且不新增 Node dependencies；精确锁定的工具版本保持不变。

- [ ] **步骤 6：运行编排测试并记录 GREEN**

运行：

```powershell
node --test scripts/workspace-config.test.mjs scripts/ci-workflow.test.mjs
pnpm turbo run dev --dry=json
```

预期：Node tests PASS。未过滤 root command 的 dry-run JSON 精确包含 `@museworks/agent-service#dev` 与 `@museworks/desktop#dev`；二者均为 `cache: false`、`persistent: true`。agent task 的 environment declaration 包含 `MUSEWORKS_AGENT_PORT`，desktop task 不包含。

- [ ] **步骤 7：证明 Turbo 持有 Python tests 与 checks**

运行：

```powershell
uv sync --project apps/agent-service --group test --locked
pnpm test
pnpm check
git diff --check
```

预期：Turbo output 包含 `@museworks/agent-service#test`；`pnpm check` 运行 agent test dependency 与 `@museworks/agent-service#check`；全部 Node、Vitest、pytest、boundary、skill、lock 与 diff gates PASS。

- [ ] **步骤 8：提交 Turbo 全栈编排**

```powershell
git add apps/agent-service/package.json apps/agent-service/turbo.json apps/desktop/package.json package.json turbo.json pnpm-lock.yaml scripts/workspace-config.test.mjs scripts/ci-workflow.test.mjs .github/workflows/ci.yml
git commit -m "feat: orchestrate full-stack development"
```

进入任务 3 前请求独立审查。审查者必须验证只有一个进程所有者（Turbo）、没有 `--parallel`、没有 Main 变更、没有重复的独立 pytest workflow step、过滤名称精确，以及只读的原生 CI 策略未变。

---

### Task 3：记录并证明全栈开发体验

**文件：**

- 修改：`README.md`
- 修改：`docs/architecture/system-overview.md`
- 修改：`docs/architecture/development-workflow.md`

**接口：**

- 消费：任务 2 的 root commands 与服务地址 `http://127.0.0.1:8765`。
- 产出：当前状态文档，以及一条命令全栈启动、独立后端启动、GUI 启动、health response 和 clean shutdown 的运行时证据。

- [ ] **步骤 1：更新当前状态文档，不添加未来能力声明**

更新 `README.md`，让主要运行章节以以下内容开始：

```powershell
# Electron + FastAPI
pnpm dev

# FastAPI only
pnpm dev:agent

# Electron only; does not start or wait for FastAPI
pnpm dev:desktop
```

环境部分必须说明：任何会进入 Python workspace 的 root command 前，`uv --version` 必须能从 PATH 解析并显示 `uv 0.11.32`。记录 `http://127.0.0.1:8765/v1/health`、`MUSEWORKS_AGENT_PORT`，并说明 Ctrl+C 是根命令正常的开发关闭方式。明确说明 Turbo 并发启动两个任务，Electron Main 不等待或管理 FastAPI，且 packaged Python sidecar 尚未实现。

更新 `docs/architecture/system-overview.md`，加入当前开发拓扑：

```text
pnpm dev → Turbo → Electron Forge/Vite
                 ↘ Uvicorn/FastAPI
```

保留 `Renderer → Preload → Electron Main → FastAPI` 作为未来连接方向；不得宣称当前 Main 调用了 health。

更新 `docs/architecture/development-workflow.md`，改用根启动命令，并说明 `pnpm test`/`pnpm check` 现在通过 workspace 桥接包含 Python。保留直接 uv 命令作为聚焦排障命令，而非第二套必需的完整测试路径。

- [ ] **步骤 2：执行仅后端运行时 smoke**

从 worktree 的后台 terminal 启动 `pnpm dev:agent`。通过可观察端点轮询而非固定 sleep：

```powershell
Invoke-RestMethod http://127.0.0.1:8765/v1/health
```

预期 JSON：

```json
{
  "status": "ok",
  "service": "museworks-agent",
  "protocolVersion": 1
}
```

终止拥有该进程的 Turbo command，然后验证本次 smoke 启动的任何进程均不再监听 8765 端口。终止前记录 parent PID 及其 descendants，确保不会误操作无关 Node/Python processes。

- [ ] **步骤 3：执行真实全栈 GUI smoke**

从 worktree 的后台 terminal 启动 `pnpm dev`，并捕获 stdout/stderr。验证下列全部可观察条件：

1. Turbo 报告 `@museworks/agent-service#dev` 与 `@museworks/desktop#dev`。
2. `Invoke-RestMethod http://127.0.0.1:8765/v1/health` 返回严格 health contract。
3. 真实 Museworks Electron window 出现，并渲染既有 app information，且没有 CSP、preload 或 renderer errors。
4. 关闭 Electron window 不产生 unhandled process error。
5. 终止 root Turbo command 后，只移除其记录的 Electron、Uvicorn/Python、Forge/Vite、Node 和 command-shell descendants，且没有任何记录的 descendant 残留。

HTTP endpoint 和 window appearance 必须使用 condition-based polling。不得将固定 sleep、旧 screenshot 或仍在运行的 orphan process 视为成功。

- [ ] **步骤 4：运行完整仓库验证**

从 worktree 重新运行：

```powershell
pnpm install --frozen-lockfile
uv sync --project apps/agent-service --group test --locked
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
uv run --project apps/agent-service --group test --locked pytest apps/agent-service/tests -q
uv lock --project apps/agent-service --check
git diff --check
```

预期：每条命令均以 0 退出；package/ASAR validation 在 Windows x64 继续成功。除非原生 GitHub Actions job 实际运行并通过，否则不得声称 macOS arm64 runtime 成功。

- [ ] **步骤 5：提交开发工作流文档**

```powershell
git add README.md docs/architecture/system-overview.md docs/architecture/development-workflow.md
git commit -m "docs: document full-stack development startup"
```

- [ ] **步骤 6：获得最终独立 L2 审查**

对设计文档基线到任务 3 的完整范围调用 `requesting-code-review`。要求 findings 按 severity 分类，并验证：

- root 与 filtered commands 能从仓库根目录工作；
- Turbo 是唯一开发进程所有者；
- Electron Main 和 Renderer behavior 未变；
- Uvicorn 只监听 loopback，port validation 严格；
- root Turbo tests 确实执行 pytest；
- CI 设置顺序支持 workspace 桥接，且没有发布或密钥；
- shutdown evidence 证明没有 task-owned process 残留；
- 文档区分开发启动与未实现的打包 sidecar。

若 review 发现 defect，返回拥有该问题的任务，添加或强化 RED test，实施最小修复，重跑该任务的 GREEN 与完整最终套件，再用聚焦 message 提交 remediation。在任何 Critical 或 Important finding 未解决前，不得关闭工作。

## 最终交付检查清单

- [ ] `git status --short --branch` 没有未提交的实现变更。
- [ ] implementation report 列出三个聚焦 commits 与任何 review remediation commit。
- [ ] Python CLI 与 workspace/CI orchestration 都已记录 RED 和 GREEN 证据。
- [ ] 全栈运行时证据包含 current PIDs、严格 health JSON、真实当前 Electron window 与干净的 descendant termination。
- [ ] 验证结果区分 Windows x64 local evidence 与尚未执行的 macOS arm64 CI。
- [ ] 不得声称 Electron Main 管理 FastAPI，也不得声称 packaged applications 包含 Python。
