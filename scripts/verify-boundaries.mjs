import { readFileSync, readdirSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join } from 'node:path';

import ts from 'typescript';

const builtinModuleNames = new Set(
  builtinModules.map((specifier) => specifier.replace(/^node:/, '')),
);

function isRendererSource(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return /\.(ts|tsx)$/.test(normalizedPath) && normalizedPath.includes('/renderer/');
}

function isBuiltinModule(specifier) {
  return builtinModuleNames.has(specifier.replace(/^node:/, ''));
}

function getStringArgument(node) {
  const argument = node.arguments[0];
  return argument && ts.isStringLiteral(argument) ? argument.text : undefined;
}

export function validateSource(filePath, source) {
  if (!isRendererSource(filePath)) {
    return;
  }

  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (isBuiltinModule(node.moduleSpecifier.text)) {
        throw new Error('renderer must not import Node built-ins');
      }
    }

    if (ts.isCallExpression(node)) {
      const specifier = getStringArgument(node);
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;

      if ((isRequire || isDynamicImport) && specifier && isBuiltinModule(specifier)) {
        throw new Error('renderer must not import Node built-ins');
      }

      if (ts.isIdentifier(node.expression) && node.expression.text === 'fetch') {
        throw new Error('renderer must not call network APIs');
      }

      if (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === 'axios'
      ) {
        throw new Error('renderer must not call network APIs');
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

function findRendererSourceFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...findRendererSourceFiles(entryPath));
    } else if (isRendererSource(entryPath)) {
      files.push(entryPath);
    }
  }

  return files;
}

export function verifyBoundaries(rootDirectory = process.cwd()) {
  const rendererFiles = findRendererSourceFiles(join(rootDirectory, 'apps'));
  const violations = [];

  for (const filePath of rendererFiles) {
    try {
      validateSource(filePath, readFileSync(filePath, 'utf8'));
    } catch (error) {
      violations.push(`${filePath}: ${error.message}`);
    }
  }

  if (violations.length > 0) {
    throw new Error(violations.join('\n'));
  }
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  try {
    verifyBoundaries();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
