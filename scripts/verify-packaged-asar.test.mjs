import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { isPackagedAsarPath, verifyPackagedAsar } from './verify-packaged-asar.mjs';

test('recognizes normalized Windows and macOS packaged ASAR paths', () => {
  assert.equal(isPackagedAsarPath('Museworks-win32-x64\\resources\\app.asar'), true);
  assert.equal(
    isPackagedAsarPath('Museworks-darwin-arm64/Museworks.app/Contents/Resources/app.asar'),
    true,
  );
  assert.equal(isPackagedAsarPath('Museworks-win32-x64/resources/other.asar'), false);
});

test('finds a packaged ASAR below the supplied output directory', () => {
  const outputDirectory = mkdtempSync(join(tmpdir(), 'museworks-asar-'));

  try {
    const resourcesDirectory = join(
      outputDirectory,
      'Museworks-darwin-arm64',
      'Museworks.app',
      'Contents',
      'Resources',
    );
    mkdirSync(resourcesDirectory, { recursive: true });
    writeFileSync(join(resourcesDirectory, 'app.asar'), 'fixture');

    assert.match(
      verifyPackagedAsar(outputDirectory),
      /museworks-darwin-arm64\/museworks\.app\/contents\/resources\/app\.asar$/,
    );
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
});

test('fails with an actionable error when the packaged ASAR is absent', () => {
  const outputDirectory = mkdtempSync(join(tmpdir(), 'museworks-asar-'));

  try {
    assert.throws(
      () => verifyPackagedAsar(outputDirectory),
      /missing packaged resources\/app\.asar/,
    );
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
});
