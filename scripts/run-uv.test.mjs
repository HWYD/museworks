import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveUvExecutable, uvNotFoundMessage } from './run-uv.mjs';

test('prefers the PATH uv executable over the Windows fallback', () => {
  const pathUv = 'C:\\tools\\uv.exe';
  const fallbackUv = 'C:\\Users\\dev\\.local\\bin\\uv.exe';
  const executablePaths = new Set([pathUv, fallbackUv]);

  assert.equal(
    resolveUvExecutable({
      platform: 'win32',
      env: { PATH: 'C:\\tools', USERPROFILE: 'C:\\Users\\dev' },
      isExecutable: (candidate) => executablePaths.has(candidate),
    }),
    pathUv,
  );
});

test('falls back to the official Windows user executable directory', () => {
  const fallbackUv = 'C:\\Users\\dev\\.local\\bin\\uv.exe';

  assert.equal(
    resolveUvExecutable({
      platform: 'win32',
      env: { PATH: 'C:\\missing', USERPROFILE: 'C:\\Users\\dev' },
      isExecutable: (candidate) => candidate === fallbackUv,
    }),
    fallbackUv,
  );
});

test('uses the system home when Turbo omits USERPROFILE on Windows', () => {
  const fallbackUv = 'C:\\Users\\dev\\.local\\bin\\uv.exe';

  assert.equal(
    resolveUvExecutable({
      platform: 'win32',
      env: { PATH: 'C:\\missing' },
      homeDirectory: 'C:\\Users\\dev',
      isExecutable: (candidate) => candidate === fallbackUv,
    }),
    fallbackUv,
  );
});

test('does not invent a fallback outside Windows', () => {
  assert.equal(
    resolveUvExecutable({
      platform: 'darwin',
      env: { PATH: '/missing', HOME: '/Users/dev' },
      isExecutable: () => false,
    }),
    null,
  );
});

test('ignores empty PATH entries and relative Windows user profiles', () => {
  assert.equal(
    resolveUvExecutable({
      platform: 'win32',
      env: { PATH: ';;', USERPROFILE: 'relative-profile' },
      isExecutable: () => true,
    }),
    null,
  );
});

test('returns an actionable UTF-8-safe error without dumping PATH', () => {
  const message = uvNotFoundMessage({ platform: 'win32' });

  assert.match(message, /uv 0\.11\.32/);
  assert.match(message, /https:\/\/docs\.astral\.sh\/uv\/getting-started\/installation\//);
  assert.match(message, /%USERPROFILE%\\\.local\\bin\\uv\.exe/);
  assert.doesNotMatch(message, /PATH=/);
});
