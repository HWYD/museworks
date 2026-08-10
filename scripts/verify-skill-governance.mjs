import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const manifestPath = resolve(repositoryRoot, '.agents', 'skills-manifest.yaml');
const allowedStatuses = new Set(['enabled', 'quarantined', 'rejected']);
export const projectSkills = [
  'museworks-best-practices-router',
  'museworks-electron-best-practices',
];

export async function loadSkillsManifest(path = manifestPath) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export function validateSkillsManifest(manifest) {
  const errors = [];
  if (manifest?.schemaVersion !== 1) {
    errors.push('schemaVersion must be 1');
  }
  if (!manifest?.reviewPolicy?.cadence || !manifest?.reviewPolicy?.nextReviewAt) {
    errors.push('reviewPolicy must define cadence and nextReviewAt');
  }
  if (!Array.isArray(manifest?.skills)) {
    return [...errors, 'skills must be an array'];
  }

  const names = new Set();
  for (const skill of manifest.skills) {
    const prefix = skill?.name ?? '<unnamed>';
    if (!skill?.name || names.has(skill.name)) {
      errors.push(`${prefix}: name must be present and unique`);
    }
    names.add(skill?.name);
    if (!skill?.source?.repository || !skill?.source?.path || !skill?.source?.installFolder) {
      errors.push(`${prefix}: source repository, path and installFolder are required`);
    }
    if (skill?.source?.repository === 'local') {
      if (
        skill?.source?.commitSha !== 'repository-versioned' ||
        skill?.installScope !== 'project'
      ) {
        errors.push(`${prefix}: local skills must be repository-versioned and project-scoped`);
      }
    } else if (!/^[0-9a-f]{40}$/.test(skill?.source?.commitSha ?? '')) {
      errors.push(`${prefix}: external skills require an exact 40-character commit SHA`);
    }
    if (!['global', 'project'].includes(skill?.installScope)) {
      errors.push(`${prefix}: installScope must be global or project`);
    }
    if (!allowedStatuses.has(skill?.status)) {
      errors.push(`${prefix}: status must be enabled, quarantined or rejected`);
    }
    for (const field of ['triggers', 'projectOverrides', 'disabledAdvice']) {
      if (!Array.isArray(skill?.[field]) || skill[field].length === 0) {
        errors.push(`${prefix}: ${field} must be a non-empty array`);
      }
    }
    if (!skill?.reviewedAt || !skill?.reviewer || !skill?.nextReviewAt) {
      errors.push(`${prefix}: review date, reviewer and next review date are required`);
    }
  }

  for (const [name, expected] of [
    ['web-design-guidelines', 'quarantined'],
    ['pnpm', 'rejected'],
    ['security-best-practices', 'quarantined'],
  ]) {
    const actual = manifest.skills.find((skill) => skill.name === name)?.status;
    if (actual !== expected) {
      errors.push(`${name}: audited status must remain ${expected}`);
    }
  }

  for (const name of projectSkills) {
    const skill = manifest.skills.find((candidate) => candidate.name === name);
    if (
      !skill ||
      skill.status !== 'enabled' ||
      skill.installScope !== 'project' ||
      skill.source?.repository !== 'local'
    ) {
      errors.push(`${name}: project skill must be registered and enabled`);
    }
  }

  return errors;
}

export function validateProjectSkillFiles(readProjectFile) {
  const errors = [];
  for (const name of projectSkills) {
    for (const relative of ['SKILL.md', join('agents', 'openai.yaml')]) {
      const path = join('.agents', 'skills', name, relative);
      if (readProjectFile(path) === undefined) {
        errors.push(`${name}: missing ${relative}`);
      }
    }
    const skillText = readProjectFile(join('.agents', 'skills', name, 'SKILL.md')) ?? '';
    const normalizedSkillText = skillText.replace(/\r\n/g, '\n');
    if (!normalizedSkillText.startsWith(`---\nname: ${name}\n`)) {
      errors.push(`${name}: SKILL.md frontmatter name must match its directory`);
    }
  }
  return errors;
}

function validateProjectSkillFilesOnDisk() {
  return validateProjectSkillFiles((relativePath) => {
    try {
      return readFileSync(resolve(repositoryRoot, relativePath), 'utf8');
    } catch {
      return undefined;
    }
  });
}

async function main() {
  const manifest = await loadSkillsManifest();
  const errors = [...validateSkillsManifest(manifest), ...validateProjectSkillFilesOnDisk()];
  if (errors.length > 0) {
    for (const error of errors) {
      process.stderr.write(`- ${error}\n`);
    }
    process.exitCode = 1;
    return;
  }
  const enabled = manifest.skills.filter((skill) => skill.status === 'enabled').length;
  process.stdout.write(
    `Skill governance verified: ${manifest.skills.length} entries, ${enabled} enabled.\n`,
  );
}

const invokedUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedUrl === import.meta.url) {
  await main();
}
