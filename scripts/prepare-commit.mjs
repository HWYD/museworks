import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { verifyStagedChanges } from './verify-staged-changes.mjs';

function hasStagedChanges(cwd) {
  const result = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd, encoding: 'utf8' });
  if (result.error) {
    throw result.error;
  }
  if (result.status === 0) {
    return false;
  }
  if (result.status === 1) {
    return true;
  }
  throw new Error(`${result.stdout}${result.stderr}`.trim() || '无法检查 Git 暂存区。');
}

export function prepareCommit({ cwd = process.cwd() } = {}) {
  if (!hasStagedChanges(cwd)) {
    throw new Error('没有已暂存的改动。请先执行 git add <文件>，再运行 pnpm commit。');
  }
  verifyStagedChanges({ cwd });
}

const invokedUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedUrl === import.meta.url) {
  try {
    prepareCommit();
    process.stdout.write('Staged changes are ready for the commit wizard.\n');
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
