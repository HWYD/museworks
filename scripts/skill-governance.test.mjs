import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { routeSkills } from '../.agents/skills/museworks-best-practices-router/scripts/route-skills.mjs';
import { loadSkillsManifest, validateSkillsManifest } from './verify-skill-governance.mjs';

function expectIncludes(actual, expected) {
  for (const value of expected) {
    assert.ok(actual.includes(value), `expected ${JSON.stringify(actual)} to include ${value}`);
  }
}

test('Renderer UI changes load React guidance without backend guidance', () => {
  const route = routeSkills({
    paths: ['apps/desktop/src/renderer/App.tsx', 'apps/desktop/src/renderer/styles.css'],
    intent: 'user-visible responsive UI',
    level: 'L1',
  });

  expectIncludes(route.required, [
    'using-superpowers',
    'museworks-best-practices-router',
    'vercel-react-best-practices',
    'test-driven-development',
  ]);
  assert.ok(!route.required.includes('fastapi'));
  assert.ok(!route.required.includes('python-testing-patterns'));
  assert.ok(!route.required.includes('museworks-electron-best-practices'));
  expectIncludes(route.forbidden, ['web-design-guidelines:floating-network-rules']);
});

test('Renderer routes reject direct privileged capabilities', () => {
  const route = routeSkills({
    paths: ['apps/desktop/src/renderer/App.tsx'],
    intent: 'call FastAPI directly with fetch and read process.env',
    level: 'L2',
  });

  expectIncludes(route.forbidden, [
    'renderer-direct-http',
    'renderer-node-access',
    'renderer-filesystem-access',
    'renderer-environment-access',
    'renderer-secret-access',
  ]);
  assert.ok(!route.required.includes('fastapi'));
});

test('public React component API changes add composition guidance', () => {
  const route = routeSkills({
    paths: ['apps/desktop/src/renderer/components/Composer.tsx'],
    intent: 'public component API with too many boolean props',
    level: 'L1',
  });

  expectIncludes(route.required, ['vercel-react-best-practices', 'vercel-composition-patterns']);
});

test('Preload IPC changes require Electron security and reject broad IPC', () => {
  const route = routeSkills({
    paths: ['apps/desktop/src/preload/index.ts', 'packages/contracts/src/desktop.ts'],
    intent: 'expose a generic ipc invoke channel',
    level: 'L2',
  });

  expectIncludes(route.required, ['museworks-electron-best-practices', 'requesting-code-review']);
  expectIncludes(route.forbidden, ['broad-ipc', 'renderer-node-access']);
});

test('Electron routes reject explicit insecure BrowserWindow settings', () => {
  const route = routeSkills({
    paths: ['apps/desktop/src/main/window.ts'],
    intent: 'set sandbox: false and contextIsolation: false',
    level: 'L2',
  });

  expectIncludes(route.forbidden, ['unsafe-electron-advice']);
});

test('FastAPI streams load async and pytest guidance and reject NDJSON', () => {
  const route = routeSkills({
    paths: ['apps/agent-service/src/museworks_agent/routes/run.py'],
    intent: 'stream SSE with cancellation and concurrent agent work, not NDJSON',
    level: 'L2',
  });

  expectIncludes(route.required, ['fastapi', 'python-testing-patterns']);
  assert.deepEqual(route.optional, []);
  expectIncludes(route.forbidden, [
    'async-python-patterns:pending-audit',
    'ndjson',
    'json-lines',
    'disconnect-means-complete',
  ]);
});

test('pnpm and Turbo changes retain exact toolchain and frozen lockfile', () => {
  const route = routeSkills({
    paths: ['package.json', 'turbo.json', 'pnpm-lock.yaml'],
    intent: 'apply a pnpm v11 config and a new Turbo future flag',
    level: 'L2',
  });

  expectIncludes(route.required, ['turborepo', 'requesting-code-review']);
  expectIncludes(route.forbidden, [
    'pnpm-skill:v11-mixed-guidance',
    'toolchain-upgrade',
    'turbo-future-flags',
  ]);
  assert.match(route.notes.join('\n'), /pnpm 10\.33\.2/);
  assert.match(route.notes.join('\n'), /Turbo 2\.2\.3/);
  assert.match(route.notes.join('\n'), /frozen lockfile/i);
});

test('test changes preserve Superpowers RED to GREEN ownership', () => {
  const vitestRoute = routeSkills({
    paths: ['apps/desktop/src/renderer/App.test.tsx'],
    intent: 'add a regression test',
    level: 'L1',
  });
  expectIncludes(vitestRoute.required, ['test-driven-development']);
  expectIncludes(vitestRoute.forbidden, ['third-party-vitest-workflow']);

  const pytestRoute = routeSkills({
    paths: ['apps/agent-service/tests/test_health.py'],
    intent: 'add a pytest fixture',
    level: 'L1',
  });
  expectIncludes(pytestRoute.required, ['test-driven-development', 'python-testing-patterns']);
});

test('L2 and L3 changes require independent review', () => {
  for (const level of ['L2', 'L3']) {
    const route = routeSkills({
      paths: ['apps/desktop/src/main/index.ts'],
      intent: 'change an external-process security boundary',
      level,
    });
    expectIncludes(route.required, ['requesting-code-review']);
    assert.equal(route.independentReviewRequired, true);
  }
});

test('CI candidates remain forbidden until pinned audit is complete', () => {
  const route = routeSkills({
    paths: ['.github/workflows/ci.yml'],
    intent: 'change GitHub Actions runtime',
    level: 'L2',
  });

  assert.deepEqual(route.optional, []);
  expectIncludes(route.forbidden, ['github-actions-authoring:pending-audit']);
});

test('upstream advice incompatible with pinned versions or boundaries is rejected', () => {
  const route = routeSkills({
    paths: [
      'apps/desktop/src/renderer/App.tsx',
      'apps/desktop/src/main/index.ts',
      'apps/agent-service/src/museworks_agent/main.py',
      'pnpm-workspace.yaml',
    ],
    intent:
      'use Next.js RSC SSR, pnpm v11, app.frontend, fastapi.sse EventSourceResponse, nodeIntegration and a generic IPC proxy',
    level: 'L3',
  });

  expectIncludes(route.forbidden, [
    'nextjs-only',
    'react-server-only',
    'pnpm-v11-only',
    'unsupported-fastapi-api',
    'unsafe-electron-advice',
    'broad-ipc',
  ]);
});

test('manifest is complete, pinned and keeps audited failures disabled', async () => {
  const manifest = await loadSkillsManifest();
  const errors = validateSkillsManifest(manifest);

  assert.deepEqual(errors, []);
  const byName = new Map(manifest.skills.map((skill) => [skill.name, skill]));

  for (const name of [
    'vercel-react-best-practices',
    'vercel-composition-patterns',
    'fastapi',
    'turborepo',
    'python-testing-patterns',
  ]) {
    assert.equal(byName.get(name)?.status, 'enabled');
    assert.match(byName.get(name)?.source.commitSha ?? '', /^[0-9a-f]{40}$/);
  }

  assert.equal(byName.get('web-design-guidelines')?.status, 'quarantined');
  assert.equal(byName.get('pnpm')?.status, 'rejected');
  assert.equal(byName.get('security-best-practices')?.status, 'quarantined');
  assert.deepEqual(
    manifest.skills
      .filter((skill) => skill.installScope === 'project')
      .map((skill) => skill.name)
      .sort(),
    ['museworks-best-practices-router', 'museworks-electron-best-practices'].sort(),
  );
});

test('standalone verifier resolves project skill metadata from the repository', () => {
  const result = spawnSync(process.execPath, ['scripts/verify-skill-governance.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Skill governance verified/);
});

test('manifest validation rejects a missing project router entry', async () => {
  const manifest = structuredClone(await loadSkillsManifest());
  manifest.skills = manifest.skills.filter(
    (skill) => skill.name !== 'museworks-best-practices-router',
  );

  assert.match(
    validateSkillsManifest(manifest).join('\n'),
    /museworks-best-practices-router: project skill must be registered and enabled/,
  );
});
