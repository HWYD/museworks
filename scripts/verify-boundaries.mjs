import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import ts from 'typescript';

const builtinModuleNames = new Set(
  builtinModules.map((specifier) => specifier.replace(/^node:/, '')),
);
const networkClientModules = new Set(['axios', 'node-fetch', 'undici', 'ky']);

function isRendererSource(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return /\.(ts|tsx)$/.test(normalizedPath) && normalizedPath.includes('/renderer/');
}

function isBuiltinModule(specifier) {
  return builtinModuleNames.has(specifier.replace(/^node:/, ''));
}

function getStaticString(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
    ? node.text
    : undefined;
}

function getStringArgument(node) {
  return node.arguments[0] ? getStaticString(node.arguments[0]) : undefined;
}

function isIdentifierNamed(node, name) {
  return ts.isIdentifier(node) && node.text === name;
}

function isGlobalPropertyAccess(node, objectName, propertyName) {
  return (
    ts.isPropertyAccessExpression(node) &&
    isIdentifierNamed(node.expression, objectName) &&
    node.name.text === propertyName
  );
}

function isProcessExpression(node) {
  return (
    isIdentifierNamed(node, 'process') || isGlobalPropertyAccess(node, 'globalThis', 'process')
  );
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

      if (networkClientModules.has(node.moduleSpecifier.text)) {
        throw new Error('renderer must not call network APIs');
      }
    }

    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const specifier = node.moduleReference.expression
        ? getStaticString(node.moduleReference.expression)
        : undefined;

      if (specifier && isBuiltinModule(specifier)) {
        throw new Error('renderer must not import Node built-ins');
      }

      if (specifier && networkClientModules.has(specifier)) {
        throw new Error('renderer must not call network APIs');
      }
    }

    if (ts.isCallExpression(node)) {
      const specifier = getStringArgument(node);
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;

      if ((isRequire || isDynamicImport) && specifier && isBuiltinModule(specifier)) {
        throw new Error('renderer must not import Node built-ins');
      }

      if ((isRequire || isDynamicImport) && specifier && networkClientModules.has(specifier)) {
        throw new Error('renderer must not call network APIs');
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

      if (
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'fetch' &&
        (isIdentifierNamed(node.expression.expression, 'window') ||
          isIdentifierNamed(node.expression.expression, 'globalThis'))
      ) {
        throw new Error('renderer must not call network APIs');
      }
    }

    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === 'env' &&
      isProcessExpression(node.expression)
    ) {
      throw new Error('renderer must not access process environment');
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

function findAppRendererSourceFiles(appsDirectory) {
  const files = [];

  for (const entry of readdirSync(appsDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const rendererDirectory = join(appsDirectory, entry.name, 'src', 'renderer');
    if (existsSync(rendererDirectory)) {
      files.push(...findRendererSourceFiles(rendererDirectory));
    }
  }

  return files;
}

export function verifyBoundaries(rootDirectory = process.cwd()) {
  const rendererFiles = findAppRendererSourceFiles(join(rootDirectory, 'apps'));
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

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    verifyBoundaries();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
