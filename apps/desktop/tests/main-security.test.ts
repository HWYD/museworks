import { describe, expect, it, vi } from 'vitest';

import { IPC_GET_APP_INFO } from '@museworks/contracts';

import { createAppInfo, registerAppInfoHandler } from '../src/main/app-info.js';
import { createWindowOptions } from '../src/main/window.js';

describe('main-process security boundary', () => {
  it('enforces isolated, sandboxed renderer web preferences', () => {
    expect(createWindowOptions('C:\\bundle\\preload.js')).toMatchObject({
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        preload: 'C:\\bundle\\preload.js',
      },
    });
  });

  it('rejects unsupported runtime platform and architecture values', () => {
    expect(() => createAppInfo('0.0.0', 'linux', 'x64')).toThrow(/unsupported platform/i);
    expect(() => createAppInfo('0.0.0', 'win32', 'ia32')).toThrow(/unsupported architecture/i);
  });

  it('registers only the named app-info handler and validates its response', async () => {
    const handlers = new Map<string, () => unknown>();
    const handle = vi.fn((channel: string, handler: () => unknown) => {
      handlers.set(channel, handler);
    });

    registerAppInfoHandler(
      { handle },
      { getVersion: () => '0.0.0' },
      { platform: 'darwin', arch: 'arm64' },
    );

    expect([...handlers.keys()]).toEqual([IPC_GET_APP_INFO]);
    expect(handlers.get(IPC_GET_APP_INFO)?.()).toEqual({
      appVersion: '0.0.0',
      platform: 'darwin',
      arch: 'arm64',
    });
  });
});
