# Upstream conflict policy

## Version pins

The repository manifests and lockfiles win over generic or newer examples. Current governance pins include React 19, Electron 43, Electron Forge 7.11.2, Vite 7.3.6, FastAPI 0.116.x, pnpm 10.33.2, Turbo 2.2.3, and Vitest 4.1.4. Verify the exact manifest before making a change.

Reject or isolate advice that depends on:

- Next.js, React Server Components, SSR, or server-only React APIs;
- Renderer 访问外部网络、任意非 `http://127.0.0.1:8765/v1/**` 的 loopback 地址，或在 `apps/desktop/src/renderer/lib/local-agent-client.ts` 之外使用网络 API；
- pnpm v11 configuration semantics;
- Turbo future flags, experimental boundaries, or commands unavailable in 2.2.3;
- FastAPI APIs absent from 0.116.x, including examples that require upgrading FastAPI;
- JSON Lines, NDJSON, custom delimiters, or connection-close completion;
- `nodeIntegration: true`, disabled sandbox/context isolation, a generic IPC proxy, arbitrary file/network/process access, or Renderer-visible secrets.

The sole future local-service exception is deliberately narrow: `apps/desktop/src/renderer/lib/local-agent-client.ts` may use browser-native `fetch` and `EventSource` for ordinary Agent API, Artifact, and standard SSE requests to `http://127.0.0.1:8765/v1/**`. Route this exact path as an Electron boundary that requires `museworks-electron-best-practices`, not FastAPI guidance. It does not authorize network libraries, WebSocket, `XMLHttpRequest`, `sendBeacon`, ComfyUI access, or a generic Preload/Main proxy. Before the first API is implemented, require the approved custom protocol, restrictive CSP, exact CORS, and tested standard-SSE prerequisites recorded in ADR-0004.

## Candidate status

- `web-design-guidelines` is quarantined because its current `SKILL.md` requires fetching a floating `main` document during use. Use repository UI rules and reviewed source material instead; do not perform that fetch.
- `pnpm` is rejected because the audited candidate mixes pnpm v11 behavior into a pnpm 10 claim and conflicts with the repository's valid `.npmrc` and `package.json.pnpm` usage.
- `security-best-practices` is quarantined pending completion of its large language/framework reference audit and reconciliation of conflicting public audit signals. Use project security rules and the Electron project skill meanwhile.

## Update flow

Discover a new revision, stage it outside active skill directories, read its complete `SKILL.md` and direct references, run route regressions, obtain independent review, then update the exact commit SHA and review dates in the manifest. Never track a floating branch.
