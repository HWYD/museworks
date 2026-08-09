import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const manifestUrl = new URL('../../../skills-manifest.yaml', import.meta.url);
const manifest = JSON.parse(readFileSync(manifestUrl, 'utf8'));
const statusByName = new Map(manifest.skills.map((skill) => [skill.name, skill.status]));

function unique(values) {
  return [...new Set(values)];
}

function normalizedPaths(paths) {
  return paths.map((path) => path.replaceAll('\\', '/').toLowerCase());
}

function addEnabled(required, forbidden, name) {
  if (statusByName.get(name) === 'enabled') {
    required.push(name);
  } else {
    forbidden.push(`${name}:${statusByName.get(name) ?? 'unregistered'}`);
  }
}

function workflowForLevel(level) {
  const git = {
    stage: 'explicit-user-request-only',
    commit: 'explicit-user-request-only',
  };

  if (level === 'L2') {
    return {
      profile: 'standard',
      trackedArtifacts: ['concise-plan'],
      worktreeRequired: true,
      execution: 'inline',
      review: 'final-independent',
      ephemeralTaskDocs: false,
      git,
    };
  }

  if (level === 'L3') {
    return {
      profile: 'full',
      trackedArtifacts: ['design', 'implementation-plan'],
      worktreeRequired: true,
      execution: 'subagent-driven',
      review: 'per-task-and-final',
      ephemeralTaskDocs: true,
      git,
    };
  }

  return {
    profile: 'light',
    trackedArtifacts: [],
    worktreeRequired: false,
    execution: 'inline',
    review: 'self',
    ephemeralTaskDocs: false,
    git,
  };
}

export function routeSkills({ paths = [], intent = '', level = 'L1' } = {}) {
  if (!['L0', 'L1', 'L2', 'L3'].includes(level)) {
    throw new RangeError(`Unsupported Museworks change level: ${level}`);
  }

  const normalized = normalizedPaths(paths);
  const lowerIntent = intent.toLowerCase();
  const required = ['using-superpowers', 'museworks-best-practices-router'];
  const optional = [];
  const forbidden = [];
  const notes = [];

  const renderer = normalized.some((path) => path.includes('/src/renderer/'));
  const electron = normalized.some(
    (path) =>
      path.includes('/src/main/') ||
      path.includes('/src/preload/') ||
      path.endsWith('/forge.config.ts') ||
      /vite\.(main|preload|renderer)\.config\.[cm]?[jt]s$/.test(path),
  );
  const python = normalized.some(
    (path) => path.startsWith('apps/agent-service/') || path.includes('/agent-service/'),
  );
  const testFiles = normalized.some((path) => /(^|\/)(tests?\/|[^/]+\.(test|spec)\.)/.test(path));
  const workspaceConfig = normalized.some(
    (path) =>
      path === 'package.json' ||
      path === 'pnpm-workspace.yaml' ||
      path === 'pnpm-lock.yaml' ||
      path === 'turbo.json' ||
      path.endsWith('/package.json'),
  );
  const ci = normalized.some((path) => path.startsWith('.github/workflows/'));
  const streaming = /\bsse\b|stream|eventsource|cancel|concurren/.test(lowerIntent);
  const componentApi =
    /public component|component api|boolean prop|compound component|composition/.test(lowerIntent);

  if (level !== 'L0') {
    required.push('test-driven-development');
  }

  if (renderer) {
    addEnabled(required, forbidden, 'vercel-react-best-practices');
    forbidden.push(
      'renderer-direct-http',
      'renderer-node-access',
      'renderer-filesystem-access',
      'renderer-environment-access',
      'renderer-secret-access',
    );
    if (componentApi) {
      addEnabled(required, forbidden, 'vercel-composition-patterns');
    }
    if (/user-visible|\bui\b|layout|responsive|accessib|interaction/.test(lowerIntent)) {
      forbidden.push('web-design-guidelines:floating-network-rules');
      notes.push(
        'Use repository UI/accessibility rules; the floating-network Web Design skill is quarantined.',
      );
    }
  }

  if (electron) {
    required.push('museworks-electron-best-practices');
    forbidden.push('renderer-node-access');
  }

  if (python) {
    addEnabled(required, forbidden, 'fastapi');
    addEnabled(required, forbidden, 'python-testing-patterns');
  }

  if (streaming && python) {
    forbidden.push(
      'async-python-patterns:pending-audit',
      'ndjson',
      'json-lines',
      'disconnect-means-complete',
    );
    notes.push(
      'Streaming must remain standard SSE with explicit incremental, completion, error, and cancellation events.',
      'Async Python guidance cannot be loaded until it has an exact SHA, completed audit, and enabled manifest entry.',
    );
  }

  if (workspaceConfig) {
    addEnabled(required, forbidden, 'turborepo');
    forbidden.push('pnpm-skill:v11-mixed-guidance', 'toolchain-upgrade', 'turbo-future-flags');
    notes.push(
      'Preserve pnpm 10.33.2, Turbo 2.2.3, exact manifests, the hoisted Forge layout, and the frozen lockfile.',
    );
  }

  if (testFiles) {
    required.push('test-driven-development');
    forbidden.push('third-party-vitest-workflow');
  }

  if (ci) {
    forbidden.push('github-actions-authoring:pending-audit');
    notes.push(
      'CI keeps read-only permissions, no publish/release step, and native Windows x64 plus macOS arm64 jobs.',
      'GitHub Actions authoring guidance cannot be loaded until it is pinned, audited, and enabled in the manifest.',
    );
  }

  if (level === 'L2' || level === 'L3') {
    required.push('using-git-worktrees', 'requesting-code-review');
  }
  if (level === 'L3') {
    required.push('brainstorming', 'writing-plans', 'subagent-driven-development');
    notes.push(
      'L3 requires an approved design, implementation plan, subagent-driven execution, per-task review, and final independent review.',
    );
  }

  if (/generic ipc|broad ipc|ipc proxy|arbitrary ipc|generic.*invoke/.test(lowerIntent)) {
    forbidden.push('broad-ipc');
  }
  if (
    /\bnodeintegration\b|sandbox\s*[:=]\s*false|context.?isolation\s*[:=]\s*false|disable.*sandbox|disable.*context.?isolation|unsafe electron/.test(
      lowerIntent,
    )
  ) {
    forbidden.push('unsafe-electron-advice');
  }
  if (/next\.js|\bnextjs\b|\brsc\b|\bssr\b/.test(lowerIntent)) {
    forbidden.push('nextjs-only', 'react-server-only');
  }
  if (/pnpm\s*v?11|pnpm-v11/.test(lowerIntent)) {
    forbidden.push('pnpm-v11-only');
  }
  if (/app\.frontend|router\.frontend|fastapi\.sse|eventsourceresponse/.test(lowerIntent)) {
    forbidden.push('unsupported-fastapi-api');
  }

  return {
    level,
    workflow: workflowForLevel(level),
    required: unique(required),
    optional: unique(optional),
    forbidden: unique(forbidden),
    notes: unique(notes),
    independentReviewRequired: level === 'L2' || level === 'L3',
  };
}

function parseArguments(argv) {
  const paths = [];
  let intent = '';
  let level = 'L1';
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--intent') {
      intent = argv[index + 1] ?? '';
      index += 1;
    } else if (argv[index] === '--level') {
      level = argv[index + 1] ?? 'L1';
      index += 1;
    } else {
      paths.push(argv[index]);
    }
  }
  return { paths, intent, level };
}

const invokedUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedUrl === import.meta.url) {
  process.stdout.write(
    `${JSON.stringify(routeSkills(parseArguments(process.argv.slice(2))), null, 2)}\n`,
  );
}
