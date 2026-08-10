import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { validateSource } from './verify-boundaries.mjs';
import { validateProjectSkillFiles, validateSkillsManifest } from './verify-skill-governance.mjs';

function runGit(cwd, args, allowFailure = false) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`${result.stdout}${result.stderr}`.trim() || `git ${args.join(' ')} failed`);
  }
  return result;
}

function listStagedPaths(cwd) {
  return runGit(cwd, ['diff', '--cached', '--name-only', '-z'])
    .stdout.split('\0')
    .filter(Boolean)
    .map((path) => path.replace(/\\/g, '/'));
}

function readIndexFile(cwd, path) {
  const result = runGit(cwd, ['show', `:${path}`], true);
  return result.status === 0 ? result.stdout : undefined;
}

function verifyStagedRendererBoundaries(cwd, stagedPaths) {
  const rendererPaths = stagedPaths.filter((path) =>
    /^apps\/[^/]+\/src\/renderer\/.*\.(ts|tsx)$/.test(path),
  );

  for (const path of rendererPaths) {
    const source = readIndexFile(cwd, path);
    if (source !== undefined) {
      validateSource(path, source);
    }
  }
}

function verifyStagedSkillGovernance(cwd, stagedPaths) {
  if (!stagedPaths.some((path) => path.startsWith('.agents/'))) {
    return;
  }

  const manifestText = readIndexFile(cwd, '.agents/skills-manifest.yaml');
  if (manifestText === undefined) {
    throw new Error('Skill governance violations:\n- skills manifest missing from staged index');
  }

  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch {
    throw new Error('Skill governance violations:\n- skills manifest must contain valid JSON');
  }

  const errors = [
    ...validateSkillsManifest(manifest),
    ...validateProjectSkillFiles((path) => readIndexFile(cwd, path)),
  ];
  if (errors.length > 0) {
    throw new Error(
      `Skill governance violations:\n${errors.map((error) => `- ${error}`).join('\n')}`,
    );
  }
}

export function verifyStagedChanges({ cwd = process.cwd() } = {}) {
  runGit(cwd, ['diff', '--cached', '--check']);
  const stagedPaths = listStagedPaths(cwd);
  verifyStagedRendererBoundaries(cwd, stagedPaths);
  verifyStagedSkillGovernance(cwd, stagedPaths);
}

const invokedUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedUrl === import.meta.url) {
  try {
    verifyStagedChanges();
    process.stdout.write('Staged changes verified.\n');
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
