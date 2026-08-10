import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

function runGit(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
}

async function createRepository(context) {
  const directory = await mkdtemp(join(tmpdir(), 'museworks-commit-workflow-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  runGit(directory, ['init', '--quiet']);
  return directory;
}

async function stageFile(directory, relativePath, content) {
  const filePath = join(directory, relativePath);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
  runGit(directory, ['add', '--', relativePath]);
  return filePath;
}

test('configures an emoji-assisted commit wizard after the staged index gate', async () => {
  const manifest = JSON.parse(await readFile('package.json', 'utf8'));
  const preCommit = await readFile('.husky/pre-commit', 'utf8');
  const commitMessage = await readFile('.husky/commit-msg', 'utf8');
  const config = await import('../commitlint.config.cjs');

  assert.equal(manifest.scripts.prepare, 'husky');
  assert.equal(manifest.scripts['verify:commit'], 'node scripts/verify-staged-changes.mjs');
  assert.equal(manifest.scripts.commit, 'node scripts/prepare-commit.mjs && git-cz');
  assert.equal(manifest.scripts['lint-staged'], 'lint-staged');
  assert.equal(manifest.scripts.commitlint, 'commitlint');
  assert.deepEqual(manifest['lint-staged']['*.{js,mjs,ts,tsx}'], [
    'eslint --max-warnings=0 --fix',
    'prettier --write',
  ]);
  assert.equal(manifest['lint-staged']['*.{json,yaml,yml,md,css,html}'], 'prettier --write');
  assert.match(preCommit, /pnpm run lint-staged[\s\S]*pnpm verify:commit/);
  assert.match(commitMessage, /pnpm run commitlint --edit "\$1"/);
  assert.doesNotMatch(commitMessage, /pnpm run commitlint -- --edit/);
  assert.equal(manifest.config.commitizen.path, 'node_modules/cz-git');
  assert.equal(config.default.prompt.useEmoji, false);
  assert.equal(config.default.prompt.allowCustomScopes, true);
  assert.equal(config.default.prompt.allowEmptyScopes, true);
  assert.equal(config.default.prompt.markBreakingChangeMode, true);
  assert.deepEqual(config.default.prompt.allowBreakingChanges, []);
  assert.match(config.default.prompt.types[0].name, /✨/);
  assert.match(config.default.prompt.messages.type, /选择本次提交类型/);
  assert.match(config.default.prompt.messages.confirmCommit, /确认提交/);
  assert.deepEqual(
    config.default.prompt.scopes.map((scope) => scope.value),
    ['app', 'ui', 'api', 'core', 'config', 'deps', 'tooling', 'infra', 'security'],
  );
  assert.equal(
    config.default.prompt.formatMessageCB({
      defaultMessage: 'feat(api): add image workbench',
      markBreaking: false,
      breaking: '',
      scope: 'api',
    }),
    'feat(api): add image workbench',
  );
  assert.equal(
    config.default.prompt.formatMessageCB({
      defaultMessage: 'ci(infra): validate packaged artifacts',
      markBreaking: false,
      breaking: '',
      scope: '\u001B[33minfra\u001B[39m',
    }),
    'ci(infra): validate packaged artifacts',
  );
  assert.throws(
    () =>
      config.default.prompt.formatMessageCB({
        defaultMessage: 'feat(api/ui): add image workbench',
        markBreaking: false,
        breaking: '',
        scope: 'api/ui',
      }),
    /scope 必须是 1–32 个字符的小写 kebab-case/,
  );
  for (const scope of ['api--ui', 'api-']) {
    assert.throws(
      () =>
        config.default.prompt.formatMessageCB({
          defaultMessage: `feat(${scope}): add image workbench`,
          markBreaking: false,
          breaking: '',
          scope,
        }),
      /scope 必须是 1–32 个字符的小写 kebab-case/,
    );
  }
  assert.throws(
    () =>
      config.default.prompt.formatMessageCB({
        defaultMessage: 'feat!: change contract',
        markBreaking: true,
        breaking: '',
        scope: '',
      }),
    /BREAKING CHANGE 必须填写迁移说明/,
  );
});

test('rejects an empty staged index before opening the commit wizard', async (context) => {
  const { prepareCommit } = await import('./prepare-commit.mjs');
  const directory = await createRepository(context);

  assert.throws(() => prepareCommit({ cwd: directory }), /请先执行 git add <文件>/);
});

test('accepts safe staged content before opening the commit wizard', async (context) => {
  const { prepareCommit } = await import('./prepare-commit.mjs');
  const directory = await createRepository(context);
  await stageFile(directory, 'notes.md', 'safe staged content\n');

  assert.doesNotThrow(() => prepareCommit({ cwd: directory }));
});

test('lint-staged formats and re-stages a temporary repository file', async (context) => {
  const directory = await createRepository(context);
  const relativePath = 'format.md';
  const filePath = await stageFile(directory, relativePath, '# title\n\n-   one\n');
  const lintStagedCli = join(process.cwd(), 'node_modules', 'lint-staged', 'bin', 'lint-staged.js');
  const localBin = join(process.cwd(), 'node_modules', '.bin');
  const result = spawnSync(
    process.execPath,
    [lintStagedCli, '--cwd', directory, '--config', join(process.cwd(), 'package.json')],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, PATH: `${localBin};${process.env.PATH}` },
    },
  );

  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.equal(await readFile(filePath, 'utf8'), '# title\n\n- one\n');
  const staged = spawnSync('git', ['show', `:${relativePath}`], {
    cwd: directory,
    encoding: 'utf8',
  });
  assert.equal(staged.status, 0, staged.stderr);
  assert.equal(staged.stdout, '# title\n\n- one\n');
});

test('rejects staged renderer violations even when the worktree is changed back', async (context) => {
  const { verifyStagedChanges } = await import('./verify-staged-changes.mjs');
  const directory = await createRepository(context);
  const relativePath = 'apps/desktop/src/renderer/App.tsx';
  const filePath = await stageFile(directory, relativePath, "fetch('http://127.0.0.1:8765');\n");
  await writeFile(filePath, 'export const App = () => null;\n', 'utf8');

  assert.throws(
    () => verifyStagedChanges({ cwd: directory }),
    /renderer must not call network APIs/,
  );
});

test('rejects staged Skill governance violations even when the worktree is changed back', async (context) => {
  const { verifyStagedChanges } = await import('./verify-staged-changes.mjs');
  const directory = await createRepository(context);
  await cp('.agents', join(directory, '.agents'), { recursive: true });
  runGit(directory, ['add', '--', '.agents']);

  const manifestPath = join(directory, '.agents', 'skills-manifest.yaml');
  const validManifest = await readFile(manifestPath, 'utf8');
  await writeFile(
    manifestPath,
    validManifest.replace('"schemaVersion": 1', '"schemaVersion": 2'),
    'utf8',
  );
  runGit(directory, ['add', '--', '.agents/skills-manifest.yaml']);
  await writeFile(manifestPath, validManifest, 'utf8');

  assert.throws(() => verifyStagedChanges({ cwd: directory }), /schemaVersion must be 1/);
});

test('rejects staged whitespace errors and accepts safe staged content', async (context) => {
  const { verifyStagedChanges } = await import('./verify-staged-changes.mjs');
  const directory = await createRepository(context);
  const notePath = await stageFile(directory, 'notes.md', 'trailing whitespace   \n');
  await writeFile(notePath, 'safe worktree content\n', 'utf8');

  assert.throws(() => verifyStagedChanges({ cwd: directory }), /trailing whitespace/);

  const safeDirectory = await createRepository(context);
  await stageFile(
    safeDirectory,
    'apps/desktop/src/renderer/App.tsx',
    'export const App = () => null;\n',
  );
  assert.doesNotThrow(() => verifyStagedChanges({ cwd: safeDirectory }));
});

test('accepts supported conventional messages and rejects invalid scopes', async (context) => {
  const directory = await createRepository(context);
  const validMessage = join(directory, 'valid-message.txt');
  const invalidMessage = join(directory, 'invalid-message.txt');
  const emojiMessage = join(directory, 'emoji-message.txt');
  await writeFile(invalidMessage, 'feat(api--ui): use an invalid scope\n', 'utf8');

  const commitlintCli = join(process.cwd(), 'node_modules', '@commitlint', 'cli', 'lib', 'cli.js');
  for (const message of [
    'feat: add image workbench',
    'fix(api): validate local service port',
    'docs: explain local development',
    'style(ui): format renderer styles',
    'refactor(core): simplify startup checks',
    'perf(app): reduce startup work',
    'test(tooling): cover commit preparation',
    'build(deps): pin commit wizard dependencies',
    'ci(infra): verify staged checks',
    'chore(config): configure commit template',
    'revert: restore prior commit flow',
    'feat(api)!: change the local API contract\n\nBREAKING CHANGE: callers must update their request payload.',
  ]) {
    await writeFile(validMessage, `${message}\n`, 'utf8');
    const valid = spawnSync(process.execPath, [commitlintCli, '--edit', validMessage], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    assert.equal(valid.status, 0, `${valid.stdout}${valid.stderr}`);
  }
  const invalid = spawnSync(process.execPath, [commitlintCli, '--edit', invalidMessage], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  await writeFile(emojiMessage, '✨ feat: add image workbench\n', 'utf8');
  const emoji = spawnSync(process.execPath, [commitlintCli, '--edit', emojiMessage], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.notEqual(invalid.status, 0);
  assert.notEqual(emoji.status, 0);
});
