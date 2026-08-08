import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { validateSource } from './verify-boundaries.mjs';

const prohibitedCases = [
  ['side-effect node import', "import 'node:fs';", /renderer must not import Node built-ins/],
  ['bare Node builtin', "import fs from 'fs';", /renderer must not import Node built-ins/],
  ['require', "const fs = require('node:fs');", /renderer must not import Node built-ins/],
  ['dynamic import', "await import('node:path');", /renderer must not import Node built-ins/],
  [
    'direct fetch',
    "fetch('http://127.0.0.1:8000/v1/health');",
    /renderer must not call network APIs/,
  ],
  [
    'axios method',
    "axios.get('http://127.0.0.1:8000/v1/health');",
    /renderer must not call network APIs/,
  ],
  [
    'global fetch',
    "globalThis.fetch('http://127.0.0.1:8000/v1/health');",
    /renderer must not call network APIs/,
  ],
  [
    'window fetch',
    "window.fetch('http://127.0.0.1:8000/v1/health');",
    /renderer must not call network APIs/,
  ],
  ['axios alias import', "import request from 'axios';", /renderer must not call network APIs/],
  [
    'network client require',
    "const request = require('undici');",
    /renderer must not call network APIs/,
  ],
  ['network client dynamic import', "await import('ky');", /renderer must not call network APIs/],
  [
    'TypeScript import equals require',
    "import fs = require('node:fs');",
    /renderer must not import Node built-ins/,
  ],
  [
    'template literal require',
    'const fs = require(`node:fs`);',
    /renderer must not import Node built-ins/,
  ],
  [
    'template literal dynamic import',
    'await import(`node:path`);',
    /renderer must not import Node built-ins/,
  ],
  [
    'process environment',
    'const key = process.env.ARK_API_KEY;',
    /renderer must not access process environment/,
  ],
  [
    'global process environment',
    'const key = globalThis.process.env.ARK_API_KEY;',
    /renderer must not access process environment/,
  ],
];

for (const [name, source, expected] of prohibitedCases) {
  test(name, () => {
    assert.throws(() => validateSource('src\\renderer\\bad.ts', source), expected);
  });
}

test('allows ordinary renderer UI source', () => {
  assert.doesNotThrow(() =>
    validateSource('apps/desktop/src/renderer/placeholder.ts', "export const title = 'Museworks';"),
  );
});

test('allows restricted APIs outside renderer source', () => {
  assert.doesNotThrow(() =>
    validateSource('apps/desktop/src/main/index.ts', "import fs from 'fs';"),
  );
});

function createRendererWorkspace(source) {
  const workspace = mkdtempSync(join(tmpdir(), 'museworks-boundary-'));
  const rendererDirectory = join(workspace, 'apps', 'desktop', 'src', 'renderer');
  mkdirSync(rendererDirectory, { recursive: true });
  writeFileSync(join(rendererDirectory, 'entry.ts'), source);
  return workspace;
}

test('CLI fails when a renderer file violates a boundary', (context) => {
  const workspace = createRendererWorkspace("import 'node:fs';");
  context.after(() => rmSync(workspace, { recursive: true, force: true }));

  const result = spawnSync(process.execPath, [resolve('scripts/verify-boundaries.mjs')], {
    cwd: workspace,
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /renderer must not import Node built-ins/);
});

test('CLI succeeds for ordinary renderer source', (context) => {
  const workspace = createRendererWorkspace("export const title = 'Museworks';");
  context.after(() => rmSync(workspace, { recursive: true, force: true }));

  const result = spawnSync(process.execPath, [resolve('scripts/verify-boundaries.mjs')], {
    cwd: workspace,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
});

test('CLI ignores renderer-like files outside app source roots', (context) => {
  const workspace = createRendererWorkspace("export const title = 'Museworks';");
  const cacheDirectory = join(workspace, 'apps', 'agent-service', '.pytest_cache', 'renderer');
  mkdirSync(cacheDirectory, { recursive: true });
  writeFileSync(join(cacheDirectory, 'bad.ts'), "import 'node:fs';");
  context.after(() => rmSync(workspace, { recursive: true, force: true }));

  const result = spawnSync(process.execPath, [resolve('scripts/verify-boundaries.mjs')], {
    cwd: workspace,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
});
