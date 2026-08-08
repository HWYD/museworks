# Electron change checklist

Source baseline: [Electron security tutorial](https://www.electronjs.org/docs/latest/tutorial/security), constrained by Museworks repository rules and exact manifests.

## Design and code

- Preserve Renderer → Preload → Main direction and do not bypass it.
- Name one business capability per IPC method. Reject arbitrary channel names, paths, URLs, commands, headers, and request forwarding.
- Validate request and response schemas at runtime; avoid `any`, broad records, or error objects containing sensitive internals.
- Keep navigation, new-window, permission, protocol, and external URL handling deny-by-default and allowlist only the exact need.
- Resolve filesystem targets before access and prove they remain in the intended directory.
- Do not pass secrets through Renderer, Preload return values, command arguments, ordinary files, logs, errors, telemetry, or snapshots.
- Bound process lifetime, timeout, cancellation, output size, retries, and cleanup. Never execute a string-built shell command from untrusted data.

## Build and package

- Use the pinned Electron, Electron Forge 7.11.2, Vite 7.3.6, and repository pnpm layout unless a separate approved upgrade task changes them.
- Produce all Forge Vite targets: Main, Preload, and Renderer.
- Package into ASAR and inspect that Main, Preload, Renderer entrypoints/assets exist.
- Verify Fuses preserve ASAR integrity/only loading, disable Node CLI/environment options as configured, and match repository tests.
- Test Windows x64 and macOS arm64 on their native runners. Never report macOS success from Windows packaging.
- Perform a real Electron GUI smoke when startup, BrowserWindow, CSP, renderer layout, native architecture, packaging, or dependency layout changes. Playwright page checks may supplement but cannot replace it.

## Minimum evidence

- RED and GREEN evidence for observable behavior changes.
- Contract tests for IPC and both sides of the bridge.
- `pnpm verify:boundaries`, relevant lint/typecheck/tests, and `git diff --check`.
- For packaging-sensitive work: successful Forge package, ASAR verification, Fuse verification, native architecture check, and GUI startup/clean exit.
