import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join, posix, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import ts from 'typescript';

const builtinModuleNames = new Set(
  builtinModules.map((specifier) => specifier.replace(/^node:/, '')),
);
const networkClientModules = new Set(['axios', 'node-fetch', 'undici', 'ky']);
const localAgentClientPath = 'apps/desktop/src/renderer/lib/local-agent-client.ts';
const nativeNetworkApiNames = new Set(['fetch', 'EventSource', 'XMLHttpRequest', 'WebSocket']);

function isRendererSource(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return /\.(ts|tsx)$/.test(normalizedPath) && normalizedPath.includes('/renderer/');
}

function normalizePathForComparison(filePath) {
  return filePath.replace(/\\/g, '/');
}

function isComparisonAbsolutePath(filePath) {
  return posix.isAbsolute(filePath) || /^[a-zA-Z]:\//.test(filePath);
}

function resolvePathForComparison(filePath, rootDirectory = process.cwd()) {
  const normalizedRoot = normalizePathForComparison(rootDirectory);
  const absoluteRoot = isComparisonAbsolutePath(normalizedRoot)
    ? posix.normalize(normalizedRoot)
    : posix.resolve(normalizePathForComparison(process.cwd()), normalizedRoot);
  const normalizedPath = normalizePathForComparison(filePath);

  return isComparisonAbsolutePath(normalizedPath)
    ? posix.normalize(normalizedPath)
    : posix.resolve(absoluteRoot, normalizedPath);
}

function isLocalAgentClientSource(filePath, rootDirectory) {
  const absoluteRoot = resolvePathForComparison(rootDirectory);
  const absoluteFilePath = resolvePathForComparison(filePath, absoluteRoot);
  return posix.relative(absoluteRoot, absoluteFilePath) === localAgentClientPath;
}

function isBuiltinModule(specifier) {
  const normalizedSpecifier = specifier.replace(/^node:/, '');
  return (
    specifier.startsWith('node:') ||
    builtinModuleNames.has(normalizedSpecifier) ||
    [...builtinModuleNames].some((moduleName) => normalizedSpecifier.startsWith(`${moduleName}/`))
  );
}

function isNetworkClientModule(specifier) {
  return [...networkClientModules].some(
    (moduleName) => specifier === moduleName || specifier.startsWith(`${moduleName}/`),
  );
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

function isPropertyNameIdentifier(node) {
  return (
    ts.isIdentifier(node) && ts.isPropertyAccessExpression(node.parent) && node.parent.name === node
  );
}

function getStaticPropertyName(node) {
  if (ts.isPropertyAccessExpression(node)) {
    return node.name.text;
  }

  return ts.isElementAccessExpression(node) ? getStaticString(node.argumentExpression) : undefined;
}

function getComputedBindingPropertyName(node) {
  return ts.isComputedPropertyName(node) &&
    ts.isBindingElement(node.parent) &&
    node.parent.propertyName === node
    ? getStaticString(node.expression)
    : undefined;
}

function isGlobalObject(node) {
  if (
    isIdentifierNamed(node, 'window') ||
    isIdentifierNamed(node, 'globalThis') ||
    isIdentifierNamed(node, 'self')
  ) {
    return true;
  }

  const propertyName = getStaticPropertyName(node);
  return (
    ((propertyName === 'window' || propertyName === 'globalThis' || propertyName === 'self') &&
      (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
      isGlobalObject(node.expression)) ||
    (propertyName === 'defaultView' &&
      ts.isPropertyAccessExpression(node) &&
      isIdentifierNamed(node.expression, 'document'))
  );
}

function getReflectedGlobalPropertyName(node) {
  if (
    !ts.isCallExpression(node) ||
    !ts.isPropertyAccessExpression(node.expression) ||
    !isIdentifierNamed(node.expression.expression, 'Reflect') ||
    node.expression.name.text !== 'get'
  ) {
    return undefined;
  }

  const [target, property] = node.arguments;
  const propertyName = property ? getStaticString(property) : undefined;
  return target && isGlobalObject(target) ? propertyName : undefined;
}

function getNativeNetworkApiName(node) {
  if (ts.isIdentifier(node)) {
    return !isPropertyNameIdentifier(node) && nativeNetworkApiNames.has(node.text)
      ? node.text
      : undefined;
  }

  const propertyName = getStaticPropertyName(node);
  return propertyName &&
    nativeNetworkApiNames.has(propertyName) &&
    (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
    isGlobalObject(node.expression)
    ? propertyName
    : undefined;
}

function isNavigatorExpression(node) {
  return (
    isIdentifierNamed(node, 'navigator') ||
    (getStaticPropertyName(node) === 'navigator' &&
      (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
      isGlobalObject(node.expression))
  );
}

function isSendBeaconReference(node) {
  if (ts.isIdentifier(node)) {
    return !isPropertyNameIdentifier(node) && node.text === 'sendBeacon';
  }

  return (
    getStaticPropertyName(node) === 'sendBeacon' &&
    (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
    isNavigatorExpression(node.expression)
  );
}

function isProcessReference(node) {
  if (ts.isIdentifier(node)) {
    return !isPropertyNameIdentifier(node) && node.text === 'process';
  }

  return (
    getStaticPropertyName(node) === 'process' &&
    (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
    isGlobalObject(node.expression)
  );
}

function isAllowedLocalAgentTarget(node) {
  const target = node.arguments[0] ? getStaticString(node.arguments[0]) : undefined;

  if (!target) {
    return false;
  }

  try {
    const url = new URL(target);
    return (
      url.protocol === 'http:' &&
      url.hostname === '127.0.0.1' &&
      url.port === '8765' &&
      (url.pathname === '/v1' || url.pathname.startsWith('/v1/'))
    );
  } catch {
    return false;
  }
}

function isAllowedLocalAgentNetworkReference(node, apiName, allowsLocalAgentNetwork) {
  if (!allowsLocalAgentNetwork || (apiName !== 'fetch' && apiName !== 'EventSource')) {
    return false;
  }

  if (ts.isElementAccessExpression(node)) {
    return false;
  }

  if (
    ts.isPropertyAccessExpression(node) &&
    !isIdentifierNamed(node.expression, 'window') &&
    !isIdentifierNamed(node.expression, 'globalThis')
  ) {
    return false;
  }

  const parent = node.parent;
  const isDirectCall = ts.isCallExpression(parent) && parent.expression === node;
  const isDirectConstructor = ts.isNewExpression(parent) && parent.expression === node;

  if (apiName === 'fetch' && !isDirectCall) {
    return false;
  }

  if (apiName === 'EventSource' && !isDirectCall && !isDirectConstructor) {
    return false;
  }

  return isAllowedLocalAgentTarget(parent);
}

export function validateSource(filePath, source, rootDirectory = process.cwd()) {
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
  const allowsLocalAgentNetwork = isLocalAgentClientSource(filePath, rootDirectory);

  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      isGlobalObject(node.initializer)
    ) {
      throw new Error('renderer must not call network APIs');
    }

    if (isIdentifierNamed(node, 'require') && !isPropertyNameIdentifier(node)) {
      throw new Error('renderer must not import Node built-ins');
    }

    const reflectedPropertyName = getReflectedGlobalPropertyName(node);
    if (reflectedPropertyName === 'process') {
      throw new Error('renderer must not access process environment');
    }

    if (
      reflectedPropertyName &&
      (nativeNetworkApiNames.has(reflectedPropertyName) || reflectedPropertyName === 'sendBeacon')
    ) {
      throw new Error('renderer must not call network APIs');
    }

    const computedBindingPropertyName = getComputedBindingPropertyName(node);
    if (computedBindingPropertyName && nativeNetworkApiNames.has(computedBindingPropertyName)) {
      throw new Error('renderer must not call network APIs');
    }

    if (computedBindingPropertyName === 'sendBeacon') {
      throw new Error('renderer must not call network APIs');
    }

    const nativeNetworkApiName = getNativeNetworkApiName(node);
    if (
      nativeNetworkApiName &&
      !isAllowedLocalAgentNetworkReference(node, nativeNetworkApiName, allowsLocalAgentNetwork)
    ) {
      throw new Error('renderer must not call network APIs');
    }

    if (isSendBeaconReference(node)) {
      throw new Error('renderer must not call network APIs');
    }

    if (isProcessReference(node)) {
      throw new Error('renderer must not access process environment');
    }

    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (isBuiltinModule(node.moduleSpecifier.text)) {
        throw new Error('renderer must not import Node built-ins');
      }

      if (isNetworkClientModule(node.moduleSpecifier.text)) {
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

      if (specifier && isNetworkClientModule(specifier)) {
        throw new Error('renderer must not call network APIs');
      }
    }

    if (ts.isCallExpression(node)) {
      const specifier = getStringArgument(node);
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;

      if (isDynamicImport && !specifier) {
        throw new Error('renderer must not import Node built-ins');
      }

      if ((isRequire || isDynamicImport) && specifier && isBuiltinModule(specifier)) {
        throw new Error('renderer must not import Node built-ins');
      }

      if ((isRequire || isDynamicImport) && specifier && isNetworkClientModule(specifier)) {
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
      validateSource(filePath, readFileSync(filePath, 'utf8'), rootDirectory);
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
