import { describe, expect, it, vi } from 'vitest';

import { IPC_GET_APP_INFO } from '@museworks/contracts';

import { createAppInfo, registerAppInfoHandler } from '../src/main/app-info.js';
import { createWindowOptions } from '../src/main/window.js';
import { configureWindowSecurity } from '../src/main/window-security.js';

describe('main-process security boundary', () => {
  it('enforces isolated, sandboxed renderer web preferences', () => {
    expect(createWindowOptions('C:\\bundle\\preload.js')).toMatchObject({
      width: 1440,
      height: 1024,
      minWidth: 1080,
      minHeight: 720,
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

  it('denies popups, external navigation, and all permission requests', () => {
    let windowOpenHandler: ((details: unknown) => unknown) | undefined;
    let navigationHandler: ((event: { preventDefault(): void }, url: string) => void) | undefined;
    let permissionRequestHandler:
      | ((webContents: unknown, permission: string, callback: (granted: boolean) => void) => void)
      | undefined;
    let permissionCheckHandler:
      | ((webContents: unknown, permission: string, requestingOrigin: string) => boolean)
      | undefined;
    const setPermissionRequestHandler = vi.fn((handler) => {
      permissionRequestHandler = handler;
    });
    const setPermissionCheckHandler = vi.fn((handler) => {
      permissionCheckHandler = handler;
    });

    configureWindowSecurity(
      {
        setWindowOpenHandler: vi.fn((handler) => {
          windowOpenHandler = handler;
        }),
        on: vi.fn((event, handler) => {
          if (event === 'will-navigate') {
            navigationHandler = handler;
          }
        }),
        session: { setPermissionRequestHandler, setPermissionCheckHandler },
      } as never,
      'http://127.0.0.1:5173',
    );

    expect(windowOpenHandler?.({ url: 'https://example.com' })).toEqual({ action: 'deny' });

    const externalNavigation = { preventDefault: vi.fn() };
    navigationHandler?.(externalNavigation, 'https://example.com');
    expect(externalNavigation.preventDefault).toHaveBeenCalledOnce();

    const trustedNavigation = { preventDefault: vi.fn() };
    navigationHandler?.(trustedNavigation, 'http://127.0.0.1:5173/creative');
    expect(trustedNavigation.preventDefault).not.toHaveBeenCalled();

    const permissionCallback = vi.fn();
    permissionRequestHandler?.({}, 'notifications', permissionCallback);
    expect(permissionCallback).toHaveBeenCalledWith(false);
    expect(permissionCheckHandler?.({}, 'notifications', 'https://example.com')).toBe(false);
  });
});
