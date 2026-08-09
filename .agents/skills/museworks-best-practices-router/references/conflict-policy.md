# Upstream conflict policy

## Version pins

The repository manifests and lockfiles win over generic or newer examples. Current governance pins include React 19, Electron 43, Electron Forge 7.11.2, Vite 7.3.6, FastAPI 0.116.x, pnpm 10.33.2, Turbo 2.2.3, and Vitest 4.1.4. Verify the exact manifest before making a change.

Reject or isolate advice that depends on:

- Next.js, React Server Components, SSR, or server-only React APIs;
- direct network access from the Electron Renderer;
- pnpm v11 configuration semantics;
- Turbo future flags, experimental boundaries, or commands unavailable in 2.2.3;
- FastAPI APIs absent from 0.116.x, including examples that require upgrading FastAPI;
- JSON Lines, NDJSON, custom delimiters, or connection-close completion;
- `nodeIntegration: true`, disabled sandbox/context isolation, a generic IPC proxy, arbitrary file/network/process access, or Renderer-visible secrets.

## Candidate status

- `web-design-guidelines` is quarantined because its current `SKILL.md` requires fetching a floating `main` document during use. Use repository UI rules and reviewed source material instead; do not perform that fetch.
- `pnpm` is rejected because the audited candidate mixes pnpm v11 behavior into a pnpm 10 claim and conflicts with the repository's valid `.npmrc` and `package.json.pnpm` usage.
- `security-best-practices` is quarantined pending completion of its large language/framework reference audit and reconciliation of conflicting public audit signals. Use project security rules and the Electron project skill meanwhile.

## Update flow

Discover a new revision, stage it outside active skill directories, read its complete `SKILL.md` and direct references, run route regressions, obtain independent review, then update the exact commit SHA and review dates in the manifest. Never track a floating branch.
