---
name: museworks-best-practices-router
description: Route Museworks work to the smallest audited set of project and upstream skills. Use immediately after using-superpowers for any repository task, especially when paths span Renderer, Electron Main/Preload, FastAPI, tests, pnpm/Turbo, or CI.
---

# Museworks Best Practices Router

## Workflow

1. Read the root `AGENTS.md` and the rules required by the files in scope.
2. Identify the intended behavior, changed paths, and change level (`L0` to `L3`).
3. Run the deterministic router:

   ```powershell
   node .agents/skills/museworks-best-practices-router/scripts/route-skills.mjs --level L2 --intent "narrow preload IPC" apps/desktop/src/preload/index.ts
   ```

4. Load every `required` skill that is available. Load an `optional` skill only when its stated condition is present.
5. Do not load or follow anything in `forbidden`. Treat a missing or quarantined required candidate as a constraint, not permission to fetch an unpinned replacement.
6. Continue through the Superpowers workflow. This skill routes domain knowledge; it does not replace brainstorming, planning, TDD, review, debugging, or verification.

## Conflict Order

Use this order without exception:

1. Explicit user decision.
2. Repository `AGENTS.md`, rules, ADRs, and approved design.
3. Exact versions and lockfiles in the repository.
4. Museworks project skills.
5. Enabled upstream skills from `.agents/skills-manifest.yaml`.

Read [conflict-policy.md](references/conflict-policy.md) before applying upstream advice that changes dependencies, security boundaries, streaming, commands, or configuration.

## Hard Constraints

- Never load every skill by default.
- Never upgrade a dependency or enable a future/experimental flag merely to satisfy a skill.
- Renderer guidance cannot authorize direct HTTP, Node, environment, filesystem, or secret access.
- FastAPI guidance cannot authorize JSON Lines or NDJSON; Museworks streaming is standard SSE only.
- The external Web Design, pnpm, and OpenAI security candidates are not enabled. Their manifest status and audit reason are authoritative.
- Vitest remains governed by Superpowers TDD and repository tests; no third-party Vitest workflow is loaded.
- L2/L3 routes require independent code review. L3 still requires approved design and implementation planning before coding.
