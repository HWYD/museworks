---
name: museworks-best-practices-router
description: Route Museworks work to the smallest audited workflow profile and set of project or upstream skills. Use immediately after using-superpowers for any repository task, especially when paths span Renderer, Electron Main/Preload, FastAPI, tests, pnpm/Turbo, or CI.
---

# Museworks Best Practices Router

## Workflow

1. Read the root `AGENTS.md` and the rules required by the files in scope.
2. Read [workflow-profiles.md](references/workflow-profiles.md), inspect actual behavior and callers, then select the change level (`L0` to `L3`). Paths select domain guidance but never determine the level by themselves.
3. Run the deterministic router:

   ```powershell
   node .agents/skills/museworks-best-practices-router/scripts/route-skills.mjs --level L2 --intent "narrow preload IPC" apps/desktop/src/preload/index.ts
   ```

4. Load every `required` skill that is available. Load an `optional` skill only when its stated condition is present.
5. Do not load or follow anything in `forbidden`. Treat a missing or quarantined required candidate as a constraint, not permission to fetch an unpinned replacement.
6. Follow the returned `workflow` profile. Do not add design, planning, worktree, SDD, task documents, or independent review beyond that profile unless the user explicitly requests stronger governance.
7. Continue with the routed Superpowers and domain skills. This skill narrows the workflow; it never weakens project security boundaries or completion verification.

## Workflow Profiles

- `light` (`L0`/`L1`): inline execution, no tracked task artifacts, no new worktree, no SDD task documents, self-review only. L1 behavior changes still use minimal TDD; L0 does not.
- `standard` (`L2`): one concise plan, isolated worktree, inline execution by default, contract and caller verification, and one final independent review. Do not use the full writing-plans or SDD task template.
- `full` (`L3`): approved design and implementation plan, isolated worktree, subagent-driven development, Git-ignored task briefs/reports, per-task review, and final independent review.

An implementation plan owns its `Task N` checklist. Separate task briefs, reports, review packages, and ledgers are execution scratch created only by the full SDD profile.

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
- L2 requires one final independent code review. L3 requires approved design and planning plus per-task and final independent review.
