import assert from 'node:assert/strict';
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
