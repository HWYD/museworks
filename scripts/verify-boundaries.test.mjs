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
  [
    'computed fetch bypass',
    "window['fetch']('http://127.0.0.1:8000/v1/health');",
    /renderer must not call network APIs/,
  ],
  [
    'self fetch bypass',
    "self.fetch('http://127.0.0.1:8000/v1/health');",
    /renderer must not call network APIs/,
  ],
  [
    'window property chain fetch bypass',
    "window['window'].fetch('http://127.0.0.1:8000/v1/health');",
    /renderer must not call network APIs/,
  ],
  [
    'globalThis property chain fetch bypass',
    "globalThis['self'].fetch('http://127.0.0.1:8000/v1/health');",
    /renderer must not call network APIs/,
  ],
  [
    'global object alias fetch bypass',
    "const global = window; global.fetch('http://127.0.0.1:8000/v1/health');",
    /renderer must not call network APIs/,
  ],
  [
    'Reflect fetch bypass',
    "Reflect.get(window, 'fetch')('http://127.0.0.1:8000/v1/health');",
    /renderer must not call network APIs/,
  ],
  [
    'document default view fetch bypass',
    "document.defaultView.fetch('http://127.0.0.1:8000/v1/health');",
    /renderer must not call network APIs/,
  ],
  [
    'bare EventSource',
    "new EventSource('http://127.0.0.1:8000/v1/run');",
    /renderer must not call network APIs/,
  ],
  [
    'window EventSource',
    "new window.EventSource('http://127.0.0.1:8000/v1/run');",
    /renderer must not call network APIs/,
  ],
  ['XMLHttpRequest', 'new XMLHttpRequest();', /renderer must not call network APIs/],
  [
    'WebSocket',
    "new WebSocket('ws://127.0.0.1:8000/v1/run');",
    /renderer must not call network APIs/,
  ],
  [
    'sendBeacon',
    "navigator.sendBeacon('http://127.0.0.1:8000/v1/health');",
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
  [
    'computed process environment',
    "const key = process['env'].ARK_API_KEY;",
    /renderer must not access process environment/,
  ],
  [
    'process alias',
    'const runtime = process; const key = runtime.env.ARK_API_KEY;',
    /renderer must not access process environment/,
  ],
  [
    'window computed process environment',
    "const key = window['process'].env.ARK_API_KEY;",
    /renderer must not access process environment/,
  ],
  [
    'self process environment',
    'const key = self.process.env.ARK_API_KEY;',
    /renderer must not access process environment/,
  ],
  [
    'require alias',
    "const nodeRequire = require; nodeRequire('node:fs');",
    /renderer must not import Node built-ins/,
  ],
  [
    'non-static dynamic import',
    "await import('node:' + 'fs');",
    /renderer must not import Node built-ins/,
  ],
  [
    'network client dynamic import subpath',
    "await import('undici/index.js');",
    /renderer must not call network APIs/,
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

test('allows destructuring the named preload bridge from window', () => {
  assert.doesNotThrow(() =>
    validateSource(
      'apps/desktop/src/renderer/bridge.ts',
      'const { museworks } = window; museworks.app.getInfo();',
    ),
  );
});

test('allows native fetch and EventSource only in the local agent client path', () => {
  assert.doesNotThrow(() =>
    validateSource(
      'apps\\desktop\\src\\renderer\\lib\\local-agent-client.ts',
      [
        "fetch('http://127.0.0.1:8765/v1/health');",
        "window.fetch('http://127.0.0.1:8765/v1/health');",
        "globalThis.fetch('http://127.0.0.1:8765/v1/health');",
        "new EventSource('http://127.0.0.1:8765/v1/run');",
        "new window.EventSource('http://127.0.0.1:8765/v1/run');",
        "new globalThis.EventSource('http://127.0.0.1:8765/v1/run');",
      ].join('\n'),
    ),
  );
});

test('allows the normalized Windows local agent client path only relative to an explicit root', (context) => {
  const rootDirectory = mkdtempSync(join(tmpdir(), 'museworks-boundary-root-'));
  const allowedSource = "fetch('http://127.0.0.1:8765/v1');";
  const allowedPath = join(
    rootDirectory,
    'apps',
    'desktop',
    'src',
    'renderer',
    'lib',
    'nested',
    '..',
    'local-agent-client.ts',
  ).replaceAll('/', '\\');
  const nestedPath = join(
    rootDirectory,
    'apps',
    'desktop',
    'src',
    'renderer',
    'lib',
    'evil',
    'apps',
    'desktop',
    'src',
    'renderer',
    'lib',
    'local-agent-client.ts',
  );
  context.after(() => rmSync(rootDirectory, { recursive: true, force: true }));

  assert.doesNotThrow(() => validateSource(allowedPath, allowedSource, rootDirectory));
  assert.throws(
    () => validateSource(nestedPath, allowedSource, rootDirectory),
    /renderer must not call network APIs/,
  );
});

test('rejects non-local-v1 and dynamic request targets in the local agent client', () => {
  const filePath = 'apps/desktop/src/renderer/lib/local-agent-client.ts';

  for (const source of [
    "fetch('https://example.com/v1/run');",
    "fetch('http://127.0.0.1:8766/v1/run');",
    "fetch('http://127.0.0.1:8765/not-v1');",
    "const target = 'http://127.0.0.1:8765/v1/run'; fetch(target);",
    "new EventSource('https://example.com/v1/run');",
    "new EventSource('http://127.0.0.1:8766/v1/run');",
    "new EventSource('http://127.0.0.1:8765/not-v1');",
    "const target = 'http://127.0.0.1:8765/v1/run'; new EventSource(target);",
  ]) {
    assert.throws(() => validateSource(filePath, source), /renderer must not call network APIs/);
  }
});

test('keeps network libraries and bypass APIs forbidden in the local agent client path', () => {
  const filePath = 'apps/desktop/src/renderer/lib/local-agent-client.ts';

  for (const source of [
    "import request from 'axios';",
    "await import('undici');",
    'const request = fetch;',
    'const Stream = EventSource;',
    'const Socket = WebSocket;',
    'const Request = XMLHttpRequest;',
    'const beacon = navigator.sendBeacon;',
    "const { ['fetch']: request } = window;",
    "const { ['EventSource']: Stream } = window;",
    "const { ['WebSocket']: Socket } = window;",
    "const { ['XMLHttpRequest']: Request } = window;",
    "const { ['sendBeacon']: beacon } = navigator;",
    "window['fetch']('http://127.0.0.1:8765/v1/health');",
    "self.fetch('http://127.0.0.1:8765/v1/health');",
    "window['window'].fetch('http://127.0.0.1:8765/v1/health');",
    "globalThis['self'].fetch('http://127.0.0.1:8765/v1/health');",
    "const global = window; global.fetch('http://127.0.0.1:8765/v1/health');",
    "const key = window['process'].env.ARK_API_KEY;",
    'const key = self.process.env.ARK_API_KEY;',
    "const nodeRequire = require; nodeRequire('node:fs');",
    "new globalThis['EventSource']('http://127.0.0.1:8765/v1/run');",
    'new XMLHttpRequest();',
    "new WebSocket('ws://127.0.0.1:8765/v1/run');",
    "navigator.sendBeacon('http://127.0.0.1:8765/v1/health');",
  ]) {
    assert.throws(
      () => validateSource(filePath, source),
      /renderer must not (call network APIs|access process environment|import Node built-ins)/,
    );
  }
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
