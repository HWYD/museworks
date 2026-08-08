# Full-Stack Development Startup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `pnpm dev` start the Electron Forge + Vite desktop and the FastAPI/Uvicorn service together through Turbo, while retaining independent desktop and backend development commands.

**Architecture:** Add a real Uvicorn console entry to the Python package, then expose the Python tasks to pnpm/Turbo through a private workspace bridge package. Turbo owns both development processes without ordering or readiness checks; Electron Main remains unchanged and does not manage, spawn, or probe FastAPI in this phase.

**Tech Stack:** Node 22.22.2, pnpm 10.33.2, Turbo 2.2.3, Electron 43.2.0, Electron Forge 7.11.2, Vite 7.3.6, Python 3.12, uv 0.11.32, FastAPI 0.116.x, Uvicorn, pytest 8.4.x, Node test runner, GitHub Actions.

## Global Constraints

- Work in the existing linked worktree `D:\code\mine\museworks\.worktrees\project-bootstrap`; do not create another nested worktree.
- Preserve exact Node, pnpm, Turbo, Electron, Forge, Vite, React, FastAPI, and Vitest versions already locked by the repository.
- Add only the Uvicorn runtime dependency required to serve the existing FastAPI app; do not add a second process supervisor or `concurrently`.
- `pnpm dev` must use `turbo run dev` without `--parallel`; both package tasks are persistent and uncached.
- Turbo owns both development processes. Electron Main must not spawn, stop, health-check, wait for, or connect to FastAPI in this phase.
- FastAPI listens only on `127.0.0.1`; the default port is `8765`, and only `MUSEWORKS_AGENT_PORT` may override it with an ASCII decimal value in `1..65535`.
- Preserve `/v1/health` exactly and keep `/v1/run` unavailable. Do not add SSE, NDJSON, Ark, Deep Agents, ComfyUI, model, IPC, or Renderer HTTP behavior.
- The Python workspace bridge must not claim nonexistent lint, typecheck, or build gates. It provides only `dev`, `start`, `test`, and `check`.
- Keep CI permissions read-only, use the existing native Windows x64/macOS arm64 matrix, and do not add upload, publish, release, signing, or secrets.
- Every production behavior change follows RED → GREEN. Documentation-only changes use readability, formatting, and `git diff --check` instead of brittle content tests.
- Each implementation task receives its own independent review; the complete L2 change receives a final independent code review before completion.

## File Map

- Create `apps/agent-service/src/museworks_agent/cli.py`: validate runtime configuration and invoke Uvicorn for the existing FastAPI app.
- Create `apps/agent-service/tests/test_cli.py`: unit-test the Python entry, loopback host, reload flag, default/overridden port, and invalid port failures.
- Modify `apps/agent-service/pyproject.toml`: add Uvicorn and the `museworks-agent` console entry.
- Modify `apps/agent-service/uv.lock`: lock the new runtime dependency.
- Create `apps/agent-service/package.json`: private pnpm/Turbo bridge for Python `dev`, `start`, `test`, and `check` tasks.
- Create `apps/agent-service/turbo.json`: scope `MUSEWORKS_AGENT_PORT` to the agent-service `dev` task.
- Modify `apps/desktop/package.json`: add `dev` as the existing Forge `start` command while retaining `start`.
- Modify `package.json`: add root full-stack and filtered development commands and format the new workspace JSON.
- Modify `turbo.json`: declare the uncached persistent `dev` task.
- Modify `pnpm-lock.yaml`: register the new workspace importer without adding Node runtime dependencies.
- Modify `scripts/workspace-config.test.mjs`: contract-test all root/package/Turbo development commands and task boundaries.
- Modify `scripts/ci-workflow.test.mjs`: require Python/uv setup before Turbo tests and forbid the now-duplicated standalone pytest step.
- Modify `.github/workflows/ci.yml`: install/sync Python before root Turbo gates and let `pnpm test` own pytest execution.
- Modify `README.md`: document `pnpm dev`, independent commands, default address, and current scope.
- Modify `docs/architecture/system-overview.md`: record Turbo-owned development processes and the absence of Main lifecycle management.
- Modify `docs/architecture/development-workflow.md`: document installation, startup, shutdown, and verification commands.

---

### Task 1: Add the executable FastAPI service entry

**Files:**

- Create: `apps/agent-service/src/museworks_agent/cli.py`
- Create: `apps/agent-service/tests/test_cli.py`
- Modify: `apps/agent-service/pyproject.toml`
- Modify: `apps/agent-service/uv.lock`

**Interfaces:**

- Consumes: `museworks_agent.main:app`, the existing `/v1/health` contract, Python 3.12, and uv 0.11.32.
- Produces: `parse_port(value: str | None) -> int`, `main(argv: Sequence[str] | None = None) -> None`, and the console command `museworks-agent [--reload]`.
- Runtime constants: `HOST = "127.0.0.1"`, `DEFAULT_PORT = 8765`, `PORT_ENV = "MUSEWORKS_AGENT_PORT"`.

- [ ] **Step 1: Write the failing CLI tests**

Create `apps/agent-service/tests/test_cli.py` with these observable contracts:

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

- [ ] **Step 2: Run the focused test and capture RED**

Run:

```powershell
uv run --project apps/agent-service --group test --locked pytest apps/agent-service/tests/test_cli.py -q
```

Expected: FAIL during collection because `museworks_agent.cli` does not exist. Do not weaken the import or skip the test.

- [ ] **Step 3: Add and lock the runtime dependency and console entry**

Update `apps/agent-service/pyproject.toml` so the project section contains the existing FastAPI constraint plus Uvicorn and an explicit console script:

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

Regenerate and sync the locked environment:

```powershell
uv lock --project apps/agent-service
uv sync --project apps/agent-service --group test --locked
```

Expected: both commands PASS; `uv.lock` contains Uvicorn and still resolves FastAPI within `>=0.116,<0.117`.

- [ ] **Step 4: Implement the minimal validated CLI**

Create `apps/agent-service/src/museworks_agent/cli.py`:

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

Do not add a configurable host, shell execution, health wait, credential handling, or a second FastAPI app.

- [ ] **Step 5: Run CLI tests and capture GREEN**

Run:

```powershell
uv run --project apps/agent-service --group test --locked pytest apps/agent-service/tests/test_cli.py -q
```

Expected: all CLI tests PASS with no warnings about an unknown console entry.

- [ ] **Step 6: Re-run the complete Python contract suite**

Run:

```powershell
uv run --project apps/agent-service --group test --locked pytest apps/agent-service/tests -q
uv lock --project apps/agent-service --check
git diff --check
```

Expected: CLI tests and both existing health tests PASS; `/v1/run` remains 404; the lock check and diff check PASS.

- [ ] **Step 7: Commit the executable service entry**

```powershell
git add apps/agent-service/pyproject.toml apps/agent-service/uv.lock apps/agent-service/src/museworks_agent/cli.py apps/agent-service/tests/test_cli.py
git commit -m "feat: add agent service entrypoint"
```

Request an independent review of this task before Task 2. The reviewer must specifically check loopback-only binding, ASCII/range validation, reload isolation, no `/v1/run`, and no credential path.

---

### Task 2: Integrate Python development tasks into pnpm and Turbo

**Files:**

- Create: `apps/agent-service/package.json`
- Create: `apps/agent-service/turbo.json`
- Modify: `apps/desktop/package.json`
- Modify: `package.json`
- Modify: `turbo.json`
- Modify: `pnpm-lock.yaml`
- Modify: `scripts/workspace-config.test.mjs`
- Modify: `scripts/ci-workflow.test.mjs`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**

- Consumes: Task 1 console command `museworks-agent [--reload]` and the existing desktop Forge `start` command.
- Produces: root `pnpm dev`, `pnpm dev:agent`, and `pnpm dev:desktop`; Turbo tasks `@museworks/agent-service#dev` and `@museworks/desktop#dev`.
- Python bridge scripts: `dev`, `start`, `test`, `check`; no `lint`, `typecheck`, or `build`.

- [ ] **Step 1: Add failing workspace and CI orchestration assertions**

Extend `scripts/workspace-config.test.mjs` with a new test that reads `apps/agent-service/package.json`, `apps/agent-service/turbo.json`, `apps/desktop/package.json`, the root manifest, and root `turbo.json`, then asserts:

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

Update the existing exact `format:check` assertion so it expects `"apps/**/*.{json,ts,tsx,css,html}"` instead of the desktop-only glob.

Extend `scripts/ci-workflow.test.mjs` to assert that the `Set up Python`, `Set up uv`, and `Sync Python dependencies` steps appear before the root `pnpm test`, and that the workflow no longer invokes pytest directly:

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

Keep the existing assertions for exact action majors, uv 0.11.32, Python 3.12, permissions, native matrix, package, and ASAR.

- [ ] **Step 2: Run orchestration tests and capture RED**

Run:

```powershell
node --test scripts/workspace-config.test.mjs scripts/ci-workflow.test.mjs
```

Expected: FAIL because `apps/agent-service/package.json` and `turbo.json` do not exist, root/desktop `dev` scripts are absent, and Python setup currently follows `pnpm test`.

- [ ] **Step 3: Add the exact workspace bridge and Turbo task configuration**

Create `apps/agent-service/package.json`:

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

Create `apps/agent-service/turbo.json`:

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

Add this root task to `turbo.json` without changing existing task definitions:

```json
"dev": {
  "cache": false,
  "persistent": true
}
```

Add these root scripts before the existing gates:

```json
"dev": "turbo run dev",
"dev:agent": "turbo run dev --filter=@museworks/agent-service",
"dev:desktop": "turbo run dev --filter=@museworks/desktop"
```

Change the root formatting glob from `apps/desktop/**/*.{json,ts,tsx,css,html}` to `apps/**/*.{json,ts,tsx,css,html}` so the new JSON manifests are covered.

In `apps/desktop/package.json`, add:

```json
"dev": "node ../../node_modules/@electron-forge/cli/dist/electron-forge.js start"
```

Retain `start` with the same value for compatibility. Do not change the hoisted root Forge CLI path or add Forge CLI to the desktop package.

- [ ] **Step 4: Move Python setup ahead of Turbo gates in CI**

In `.github/workflows/ci.yml`, move the existing `Set up Python`, `Set up uv`, and `Sync Python dependencies` steps to immediately after `Install Node dependencies`. Rename `Test Node workspaces` to `Test workspaces`. Delete only the standalone `Test agent service` step because `pnpm test` now reaches the agent workspace through Turbo.

The ordered middle of the workflow must be:

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

Do not modify the workflow matrix, permissions, package, ASAR, or prohibition on release behavior.

- [ ] **Step 5: Refresh the pnpm workspace lock and verify frozen installation**

Run:

```powershell
pnpm install
pnpm install --frozen-lockfile
```

Expected: both PASS; `pnpm-lock.yaml` gains an `apps/agent-service` importer with no Node dependencies, and the exact pinned tool versions remain unchanged.

- [ ] **Step 6: Run orchestration tests and capture GREEN**

Run:

```powershell
node --test scripts/workspace-config.test.mjs scripts/ci-workflow.test.mjs
pnpm turbo run dev --dry=json
```

Expected: Node tests PASS. Dry-run JSON contains exactly `@museworks/agent-service#dev` and `@museworks/desktop#dev` for the unfiltered root command; both have `cache: false` and `persistent: true`. The agent task includes `MUSEWORKS_AGENT_PORT` in its environment declaration and the desktop task does not.

- [ ] **Step 7: Prove Turbo owns Python tests and checks**

Run:

```powershell
uv sync --project apps/agent-service --group test --locked
pnpm test
pnpm check
git diff --check
```

Expected: Turbo output includes `@museworks/agent-service#test`; `pnpm check` runs the agent test dependency and `@museworks/agent-service#check`; all Node, Vitest, pytest, boundary, skill, lock, and diff gates PASS.

- [ ] **Step 8: Commit the Turbo full-stack orchestration**

```powershell
git add apps/agent-service/package.json apps/agent-service/turbo.json apps/desktop/package.json package.json turbo.json pnpm-lock.yaml scripts/workspace-config.test.mjs scripts/ci-workflow.test.mjs .github/workflows/ci.yml
git commit -m "feat: orchestrate full-stack development"
```

Request an independent review before Task 3. The reviewer must verify there is one process owner (Turbo), no `--parallel`, no Main changes, no duplicate standalone pytest workflow step, exact filter names, and an unchanged read-only native CI policy.

---

### Task 3: Document and prove the full-stack developer experience

**Files:**

- Modify: `README.md`
- Modify: `docs/architecture/system-overview.md`
- Modify: `docs/architecture/development-workflow.md`

**Interfaces:**

- Consumes: Task 2 root commands and the service address `http://127.0.0.1:8765`.
- Produces: current-state documentation and runtime evidence for one-command full-stack startup, independent backend startup, GUI startup, health response, and clean shutdown.

- [ ] **Step 1: Update current-state documentation without adding future claims**

Update `README.md` so the primary run section begins with:

```powershell
# Electron + FastAPI
pnpm dev

# FastAPI only
pnpm dev:agent

# Electron only; does not start or wait for FastAPI
pnpm dev:desktop
```

The environment section must state that `uv --version` must resolve from PATH and report `uv 0.11.32` before any root command that reaches the Python workspace. Document `http://127.0.0.1:8765/v1/health`, `MUSEWORKS_AGENT_PORT`, and that Ctrl+C on the root command is the normal development shutdown. State explicitly that Turbo starts both tasks concurrently, Electron Main does not wait for or manage FastAPI, and packaged Python sidecar behavior is not implemented.

Update `docs/architecture/system-overview.md` with this current development topology:

```text
pnpm dev → Turbo → Electron Forge/Vite
                 ↘ Uvicorn/FastAPI
```

Keep the runtime architecture direction `Renderer → Preload → Electron Main → FastAPI` as a future connection path; do not claim the current Main calls health.

Update `docs/architecture/development-workflow.md` to use root startup commands and explain that `pnpm test`/`pnpm check` now include Python through the workspace bridge. Retain direct uv commands as focused troubleshooting commands, not as a second required full-suite path.

- [ ] **Step 2: Perform the backend-only runtime smoke**

Start `pnpm dev:agent` in a background terminal from the worktree. Poll the observable endpoint rather than sleeping a fixed duration:

```powershell
Invoke-RestMethod http://127.0.0.1:8765/v1/health
```

Expected JSON:

```json
{
  "status": "ok",
  "service": "museworks-agent",
  "protocolVersion": 1
}
```

Terminate the owning Turbo command, then verify no process that was started by this smoke remains listening on port 8765. Record the parent PID and its descendants before terminating so unrelated Node/Python processes are never targeted.

- [ ] **Step 3: Perform the real full-stack GUI smoke**

Start `pnpm dev` from the worktree in a background terminal with captured stdout/stderr. Verify all of the following observable conditions:

1. Turbo reports both `@museworks/agent-service#dev` and `@museworks/desktop#dev`.
2. `Invoke-RestMethod http://127.0.0.1:8765/v1/health` returns the strict health contract.
3. A real Museworks Electron window appears and renders the existing app information without CSP, preload, or renderer errors.
4. Closing the Electron window does not produce an unhandled process error.
5. Terminating the root Turbo command removes only its recorded Electron, Uvicorn/Python, Forge/Vite, Node, and command-shell descendants; no recorded descendant remains.

Use condition-based polling for the HTTP endpoint and window appearance. Do not treat a fixed sleep, an old screenshot, or a still-running orphan process as success.

- [ ] **Step 4: Run the complete repository verification**

Run fresh from the worktree:

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

Expected: every command exits 0; package/ASAR validation still succeeds on Windows x64. Do not claim macOS arm64 runtime success unless the native GitHub Actions job actually runs and passes.

- [ ] **Step 5: Commit the developer workflow documentation**

```powershell
git add README.md docs/architecture/system-overview.md docs/architecture/development-workflow.md
git commit -m "docs: document full-stack development startup"
```

- [ ] **Step 6: Obtain the final independent L2 review**

Invoke `requesting-code-review` over the complete range from the design-doc base through Task 3. Require findings to be classified by severity and verify:

- root and filtered commands work from the repository root;
- Turbo is the sole development process owner;
- Electron Main and Renderer behavior did not change;
- Uvicorn is loopback-only and port validation is strict;
- root Turbo tests genuinely execute pytest;
- CI setup order supports the workspace bridge without publishing or secrets;
- shutdown evidence proves no task-owned process remains;
- docs distinguish development startup from the unimplemented packaged sidecar.

If review finds a defect, return to the task that owns it, add or strengthen a RED test, implement the minimum fix, rerun that task's GREEN and the final suite, then commit the remediation with a focused message. Do not close the work while any Critical or Important finding remains.

## Final Handoff Checklist

- [ ] `git status --short --branch` shows no uncommitted implementation changes.
- [ ] The implementation report lists the three focused commits and any review remediation commit.
- [ ] RED and GREEN evidence is recorded for Python CLI and workspace/CI orchestration.
- [ ] Full-stack runtime evidence includes current PIDs, strict health JSON, a real current Electron window, and clean descendant termination.
- [ ] Verification results distinguish Windows x64 local evidence from unexecuted macOS arm64 CI.
- [ ] No claim is made that Electron Main manages FastAPI or that packaged applications include Python.
