---
name: museworks-electron-best-practices
description: Enforce Museworks Electron Main, Preload, Renderer, IPC, Forge plus Vite, ASAR, Fuse, and native GUI boundaries. Use for Electron Main or Preload code, BrowserWindow security, IPC contracts, Forge/Vite configuration, external processes, packaging, or native desktop validation.
---

# Museworks Electron Best Practices

## Required process

1. Read root `AGENTS.md`, `.agents/rules/architecture.md`, `.agents/rules/security.md`, `.agents/rules/testing.md`, and [checklist.md](references/checklist.md).
2. Classify the change as L2 when it crosses IPC, HTTP, filesystem, process, permission, or secret boundaries; classify secret persistence, release, signing, or destructive migration as L3.
3. Define a narrow named contract and its runtime validation before implementation.
4. Follow Superpowers TDD. Test both caller and handler sides for cross-boundary changes.
5. Run the smallest relevant checks, then package/ASAR/Fuse/real-GUI validation when packaging, startup, CSP, window, native module, or architecture behavior could change.

## Non-negotiable boundaries

- Renderer has DOM/UI responsibilities only and cannot use Node, direct backend HTTP, environment variables, secrets, filesystem, shell, or ComfyUI.
- Preload exposes only named, typed, purpose-specific APIs through `contextBridge`; never expose `ipcRenderer` or a generic invoke/send proxy.
- Main owns desktop permissions, controlled IPC, local service lifecycle, file/process access, and protected secret use.
- Keep `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`.
- Validate IPC inputs at runtime on both exposed and handled boundaries. Use allowlisted methods and stable error semantics.
- Keep a restrictive CSP and do not suppress Electron security warnings to make a test pass.
- Electron Forge plus Vite is the sole desktop build path. Do not add Webpack source, configuration, or direct dependencies.

Community Electron skills are non-authoritative. The repository and the official Electron security checklist linked in the reference take precedence.
