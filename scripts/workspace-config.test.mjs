import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readText = (path) => readFileSync(path, 'utf8');
const require = createRequire(import.meta.url);

const rendererFiles = 'apps/desktop/src/renderer/**/*.{ts,tsx}';

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
  assert.deepEqual(prettierIgnore, [
    'node_modules/',
    'dist/',
    '.turbo/',
    '.vite/',
    'out/',
    '**/.venv/**',
    '**/__pycache__/**',
    '**/.pytest_cache/**',
    '**/.mypy_cache/**',
    '**/.ruff_cache/**',
    '**/.coverage',
    '**/htmlcov/**',
  ]);
  assert.deepEqual(manifest.pnpm?.onlyBuiltDependencies, ['electron', 'electron-winstaller']);
  assert.equal(
    manifest.scripts['format:check'],
    'prettier --check package.json pnpm-workspace.yaml turbo.json tsconfig.json eslint.config.mjs .prettierrc.json AGENTS.md ".agents/**/*.{md,yaml,yml}" "apps/**/*.{json,ts,tsx,css,html}" "packages/**/*.{json,ts,tsx}" "scripts/**/*.{js,mjs,ts}" ".github/workflows/**/*.{yml,yaml}" README.md docs/architecture/development-workflow.md docs/architecture/skill-governance.md',
  );
  const prettierConfig = JSON.parse(readText('.prettierrc.json'));
  assert.deepEqual(prettierConfig.overrides, [
    {
      files: '.agents/skills-manifest.yaml',
      options: { parser: 'json' },
    },
  ]);
  assert.equal(manifest.scripts['verify:skills'], 'node scripts/verify-skill-governance.mjs');
  assert.equal(
    manifest.scripts.check,
    'turbo run check && pnpm verify:boundaries && pnpm verify:skills',
  );
});

test('defines Turbo-owned full-stack development entrypoints', () => {
  const rootManifest = JSON.parse(readText('package.json'));
  const rootTurbo = JSON.parse(readText('turbo.json'));
  const desktopManifest = JSON.parse(readText('apps/desktop/package.json'));
  const agentManifest = JSON.parse(readText('apps/agent-service/package.json'));
  const agentTurbo = JSON.parse(readText('apps/agent-service/turbo.json'));

  assert.equal(rootManifest.scripts.dev, 'turbo run dev');
  assert.equal(
    rootManifest.scripts['dev:server'],
    'turbo run dev --filter=@museworks/agent-service',
  );
  assert.equal(rootManifest.scripts['dev:agent'], undefined);
  assert.equal(rootManifest.scripts['dev:desktop'], 'turbo run dev --filter=@museworks/desktop');
  assert.deepEqual(rootTurbo.tasks.dev, { cache: false, persistent: true });
  assert.equal(desktopManifest.scripts.dev, desktopManifest.scripts.start);
  assert.deepEqual(agentManifest.scripts, {
    dev: 'node ../../scripts/run-uv.mjs run --locked museworks-agent --reload',
    start: 'node ../../scripts/run-uv.mjs run --locked museworks-agent',
    test: 'node ../../scripts/run-uv.mjs run --group test --locked pytest tests -q',
    check: 'node ../../scripts/run-uv.mjs lock --check',
  });
  assert.equal(agentManifest.private, true);
  assert.deepEqual(agentTurbo, {
    extends: ['//'],
    tasks: { dev: { env: ['MUSEWORKS_AGENT_PORT'] } },
  });
  for (const forbidden of ['lint', 'typecheck', 'build']) {
    assert.equal(agentManifest.scripts[forbidden], undefined);
  }
});

test('limits renderer ESLint globals to browser APIs', async () => {
  const { default: eslintConfig } = await import('../eslint.config.mjs');
  const rendererConfig = eslintConfig.find((config) => config.files?.includes(rendererFiles));

  assert.ok(rendererConfig);
  assert.equal(rendererConfig.languageOptions.globals.window, false);
  assert.equal(rendererConfig.languageOptions.globals.process, undefined);
});

test('owns the Forge CLI at the hoisted workspace root', () => {
  const rootManifest = JSON.parse(readText('package.json'));
  const desktopManifest = JSON.parse(readText('apps/desktop/package.json'));

  assert.equal(rootManifest.devDependencies['@electron-forge/cli'], '7.11.2');
  assert.equal(rootManifest.scripts['forge:desktop'], undefined);
  assert.equal(desktopManifest.devDependencies['@electron-forge/cli'], undefined);
  assert.equal(
    desktopManifest.scripts.start,
    'node ../../node_modules/@electron-forge/cli/dist/electron-forge.js start',
  );
  assert.equal(
    desktopManifest.scripts.package,
    'node ../../node_modules/@electron-forge/cli/dist/electron-forge.js package',
  );
  assert.equal(desktopManifest.scripts.build, desktopManifest.scripts.package);
});

test('pins the Forge Vite runtime to the approved desktop version', () => {
  const rootManifest = JSON.parse(readText('package.json'));
  const desktopManifest = JSON.parse(readText('apps/desktop/package.json'));
  const pluginViteManifestPath = require.resolve('@electron-forge/plugin-vite/package.json');
  const pluginViteRuntimePath = require.resolve('vite/package.json', {
    paths: [pluginViteManifestPath],
  });

  assert.equal(rootManifest.devDependencies.vite, '7.3.6');
  assert.equal(desktopManifest.devDependencies.vite, '7.3.6');
  assert.equal(require('vite/package.json').version, '7.3.6');
  assert.equal(require('../apps/desktop/node_modules/vite/package.json').version, '7.3.6');
  assert.equal(require(pluginViteRuntimePath).version, '7.3.6');
});
