import { spawnSync } from 'node:child_process';
import { accessSync, constants, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { posix, win32 } from 'node:path';
import { pathToFileURL } from 'node:url';

const UV_VERSION = '0.11.32';

const isExecutableFile = (candidate) => {
  try {
    if (!statSync(candidate).isFile()) return false;
    accessSync(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

export function resolveUvExecutable({
  platform = process.platform,
  env = process.env,
  homeDirectory = homedir(),
  isExecutable = isExecutableFile,
} = {}) {
  const path = platform === 'win32' ? win32 : posix;
  const executableName = platform === 'win32' ? 'uv.exe' : 'uv';
  const pathEntries = (env.PATH ?? '')
    .split(path.delimiter)
    .map((entry) => entry.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);

  for (const entry of pathEntries) {
    const candidate = path.resolve(entry, executableName);
    if (isExecutable(candidate)) return candidate;
  }

  const userProfile = env.USERPROFILE === undefined ? homeDirectory : env.USERPROFILE;
  if (platform === 'win32' && userProfile && path.isAbsolute(userProfile)) {
    const fallback = path.join(userProfile, '.local', 'bin', 'uv.exe');
    if (isExecutable(fallback)) return fallback;
  }

  return null;
}

export function uvNotFoundMessage({ platform = process.platform } = {}) {
  const windowsHint =
    platform === 'win32' ? ' Expected Windows fallback: %USERPROFILE%\\.local\\bin\\uv.exe.' : '';
  return `Museworks could not find uv ${UV_VERSION}.${windowsHint} Install it from https://docs.astral.sh/uv/getting-started/installation/ and reopen the terminal or repair PATH.`;
}

export function main(args = process.argv.slice(2)) {
  const executable = resolveUvExecutable();
  if (!executable) {
    console.error(uvNotFoundMessage());
    return 1;
  }

  const result = spawnSync(executable, args, {
    cwd: process.cwd(),
    env: process.env,
    shell: false,
    stdio: 'inherit',
  });
  if (result.error) {
    console.error(
      `Museworks could not start uv ${UV_VERSION}. Reinstall it from https://docs.astral.sh/uv/getting-started/installation/ and retry.`,
    );
    return 1;
  }
  return result.status ?? 1;
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
const isMain =
  entryUrl !== null &&
  (process.platform === 'win32'
    ? import.meta.url.toLowerCase() === entryUrl.toLowerCase()
    : import.meta.url === entryUrl);

if (isMain) {
  process.exitCode = main();
}
