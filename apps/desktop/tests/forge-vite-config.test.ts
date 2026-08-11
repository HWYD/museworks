import { readFileSync } from 'node:fs';

import { FuseV1Options, FuseVersion } from '@electron/fuses';
import type { UserConfig } from 'vite';
import { describe, expect, it } from 'vitest';

import forgeConfig from '../forge.config.js';
import mainViteConfig from '../vite.main.config.js';
import preloadViteConfig from '../vite.preload.config.js';
import rendererViteConfig from '../vite.renderer.config.js';

interface VitePluginConfiguration {
  concurrent: boolean;
  build: unknown[];
  renderer: Array<Record<string, unknown>>;
}

function pluginConfig(name: string): unknown {
  const plugin = forgeConfig.plugins?.find((candidate) => candidate.name === name);
  return plugin && 'config' in plugin ? plugin.config : undefined;
}

describe('Electron Forge Vite configuration', () => {
  it('loads the Forge CJS main entry without an ESM package override', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { main?: string; type?: string; config?: { forge?: string } };

    expect(manifest.main).toBe('.vite/build/main.js');
    expect(manifest.type).toBeUndefined();
    expect(manifest.config?.forge).toBe('./forge.config.ts');
  });

  it('lets Forge resolve plugin classes from package descriptors', () => {
    expect(forgeConfig.plugins?.map((plugin) => plugin.name)).toEqual([
      '@electron-forge/plugin-vite',
      '@electron-forge/plugin-fuses',
    ]);
  });

  it('builds main, preload, and the legal renderer entry sequentially', () => {
    expect(mainViteConfig).toBeDefined();
    expect(preloadViteConfig).toBeDefined();
    expect(rendererViteConfig).toBeDefined();

    const viteConfig = pluginConfig('@electron-forge/plugin-vite') as VitePluginConfiguration;
    expect(viteConfig.concurrent).toBe(false);
    expect(viteConfig.build).toEqual([
      { entry: 'src/main/index.ts', config: 'vite.main.config.ts', target: 'main' },
      { entry: 'src/preload/index.ts', config: 'vite.preload.config.ts', target: 'preload' },
    ]);
    expect(viteConfig.renderer).toEqual([
      { name: 'main_window', config: 'vite.renderer.config.ts' },
    ]);
    expect(viteConfig.renderer[0]).not.toHaveProperty('entry');
  });

  it('keeps nested index entries in distinct package output files', () => {
    const mainConfig = mainViteConfig as UserConfig;
    const preloadConfig = preloadViteConfig as UserConfig;
    const mainLibrary = mainConfig.build?.lib;
    const preloadOutput = preloadConfig.build?.rollupOptions?.output;

    expect(typeof mainLibrary).toBe('object');
    expect(typeof mainLibrary === 'object' ? mainLibrary.entry : undefined).toBe(
      'src/main/index.ts',
    );
    expect(
      typeof mainLibrary === 'object' && typeof mainLibrary.fileName === 'function'
        ? mainLibrary.fileName('cjs', 'main')
        : undefined,
    ).toBe('main.js');
    expect(Array.isArray(preloadOutput) ? undefined : preloadOutput?.entryFileNames).toBe(
      'preload.js',
    );
  });

  it('uses the React and Tailwind renderer plugins with the component alias', () => {
    const source = readFileSync(new URL('../vite.renderer.config.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/from '@vitejs\/plugin-react'/);
    expect(source).toMatch(/from '@tailwindcss\/vite'/);
    expect(source).toMatch(/plugins:\s*\[tailwindcss\(\), react\(\{\}\)\]/);
    expect(source).toMatch(/'@': fileURLToPath\(new URL\('\.\/src', import\.meta\.url\)\)/);
    expect(source).not.toMatch(/rollupOptions[\s\S]*input/);
  });

  it('packages an ASAR with hardened Electron fuses', () => {
    expect(forgeConfig.packagerConfig?.asar).toBe(true);

    expect(pluginConfig('@electron-forge/plugin-fuses')).toMatchObject({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    });
  });

  it('does not schedule a second Forge package through the workspace check task', () => {
    const turboConfig = JSON.parse(
      readFileSync(new URL('../../../turbo.json', import.meta.url), 'utf8'),
    ) as { tasks?: { check?: { dependsOn?: string[] } } };
    const desktopManifest = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { scripts?: { check?: string } };

    expect(turboConfig.tasks?.check?.dependsOn).not.toContain('build');
    expect(desktopManifest.scripts?.check).toContain('pnpm build');
  });
});
