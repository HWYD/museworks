import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readText = (path) => readFileSync(path, 'utf8');

test('enforces workspace package-manager and dot-config policy', () => {
  const npmrc = readText('.npmrc');
  const editorConfig = readText('.editorconfig');
  const prettierIgnore = readText('.prettierignore').split(/\r?\n/).filter(Boolean);
  const manifest = JSON.parse(readText('package.json'));

  assert.match(npmrc, /^engine-strict=true$/m);
  assert.match(npmrc, /^save-exact=true$/m);
  assert.match(npmrc, /^node-linker=hoisted$/m);
  assert.match(editorConfig, /^charset = utf-8$/m);
  assert.match(editorConfig, /^end_of_line = lf$/m);
  assert.deepEqual(prettierIgnore, ['node_modules/', 'dist/', '.turbo/', '.vite/', 'out/']);
  assert.deepEqual(manifest.pnpm?.onlyBuiltDependencies, ['electron', 'electron-winstaller']);
  assert.equal(
    manifest.scripts['format:check'],
    'prettier --check package.json pnpm-workspace.yaml turbo.json tsconfig.json eslint.config.mjs .prettierrc.json apps packages scripts',
  );
});
