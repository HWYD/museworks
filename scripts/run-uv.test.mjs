import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

test('does not replace an explicit empty USERPROFILE with the system home', () => {
  const fallbackUv = 'C:\\Users\\dev\\.local\\bin\\uv.exe';

  assert.equal(
    resolveUvExecutable({
      platform: 'win32',
      env: { PATH: 'C:\\missing', USERPROFILE: '' },
      homeDirectory: 'C:\\Users\\dev',
      isExecutable: (candidate) => candidate === fallbackUv,
    }),
    null,
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

test(
  'returns a fixed error when the resolved Windows uv executable cannot start',
  { skip: process.platform !== 'win32' },
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'museworks-uv-start-'));
    const fakeUv = join(directory, 'uv.exe');
    writeFileSync(fakeUv, 'not a Windows executable');

    try {
      const result = spawnSync(process.execPath, ['scripts/run-uv.mjs', '--version'], {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: { ...process.env, PATH: directory },
      });

      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.equal(
        result.stderr.trim(),
        'Museworks could not start uv 0.11.32. Reinstall it from https://docs.astral.sh/uv/getting-started/installation/ and retry.',
      );
      assert.equal(result.stderr.includes(directory), false);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  },
);
