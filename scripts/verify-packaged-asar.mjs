import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const normalizePath = (value) => value.replaceAll('\\', '/').toLowerCase();

export const isPackagedAsarPath = (value) => normalizePath(value).endsWith('/resources/app.asar');

export function verifyPackagedAsar(outputDirectory = 'apps/desktop/out') {
  if (!existsSync(outputDirectory)) {
    throw new Error(`missing packaged resources/app.asar under ${outputDirectory}`);
  }

  const relativePath = readdirSync(outputDirectory, { recursive: true }).find((entry) => {
    if (!isPackagedAsarPath(entry)) {
      return false;
    }

    return statSync(join(outputDirectory, entry)).isFile();
  });

  if (relativePath === undefined) {
    throw new Error(`missing packaged resources/app.asar under ${outputDirectory}`);
  }

  return normalizePath(relativePath);
}

const isDirectExecution =
  process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  const packagedAsar = verifyPackagedAsar(process.argv[2]);
  console.log(`verified packaged ASAR: ${packagedAsar}`);
}
