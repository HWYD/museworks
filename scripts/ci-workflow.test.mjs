import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readWorkflow = () => readFileSync('.github/workflows/ci.yml', 'utf8');

test('runs the bootstrap gates on the approved native CI matrix', () => {
  const workflow = readWorkflow();

  assert.match(workflow, /^on:\s*\n\s*push:\s*\n\s*branches:\s*\[main\]\s*\n\s*pull_request:/m);
  assert.match(workflow, /^permissions:\s*\n\s*contents:\s*read$/m);
  assert.match(workflow, /fail-fast:\s*false/);
  assert.match(
    workflow,
    /include:\s*\n\s*- runner:\s*windows-2025\s*\n\s*arch:\s*x64\s*\n\s*- runner:\s*macos-15\s*\n\s*arch:\s*arm64/m,
  );
  assert.match(workflow, /runs-on:\s*\$\{\{\s*matrix\.runner\s*\}\}/);
  assert.deepEqual(
    [...workflow.matchAll(/^\s*- runner:\s*(\S+)$/gm)].map((match) => match[1]),
    ['windows-2025', 'macos-15'],
  );
  assert.deepEqual(
    [...workflow.matchAll(/^\s*arch:\s*(\S+)$/gm)].map((match) => match[1]),
    ['x64', 'arm64'],
  );
  assert.deepEqual(
    [...workflow.slice(workflow.indexOf('jobs:\n')).matchAll(/^  ([a-z0-9_-]+):\s*$/gm)].map(
      (match) => match[1],
    ),
    ['bootstrap'],
  );

  assert.deepEqual(
    [
      ...workflow.matchAll(
        /uses:\s*((?:actions\/(?:checkout|setup-node|setup-python)|astral-sh\/setup-uv)@v\d+)/g,
      ),
    ].map((match) => match[1]),
    [
      'actions/checkout@v7',
      'actions/setup-node@v6',
      'actions/setup-python@v6',
      'astral-sh/setup-uv@v9',
    ],
  );

  assert.match(workflow, /node-version:\s*['"]?22\.22\.2['"]?/);
  assert.match(workflow, /corepack prepare pnpm@10\.33\.2 --activate/);
  assert.match(workflow, /python-version:\s*['"]3\.12['"]/);
  assert.match(workflow, /version:\s*['"]0\.11\.32['"]/);
  assert.match(workflow, /pnpm install --frozen-lockfile/);

  for (const command of [
    'pnpm lint',
    'pnpm format:check',
    'pnpm typecheck',
    'pnpm test',
    'pnpm build',
    'pnpm check',
    'pnpm verify:boundaries',
    'pnpm verify:skills',
  ]) {
    assert.match(workflow, new RegExp(command.replace(':', '\\:')));
  }

  assert.match(workflow, /uv sync --project apps\/agent-service --group test --locked/);
  assert.match(
    workflow,
    /uv run --project apps\/agent-service --group test --locked pytest apps\/agent-service\/tests -q/,
  );
  assert.match(workflow, /process\.arch\s*!==\s*['"]\$\{\{\s*matrix\.arch\s*\}\}['"]/);
  assert.match(workflow, /pnpm --filter @museworks\/desktop --fail-if-no-match package/);
  assert.match(workflow, /run:\s*node scripts\/verify-packaged-asar\.mjs/);
  assert.doesNotMatch(workflow, /node -e .*resources\/app\.asar/);

  assert.doesNotMatch(
    workflow,
    /upload-artifact|publish|release|signing|signtool|codesign|secrets(?:\.|\[)|^\s*[a-z-]+:\s*write$/im,
  );
});
