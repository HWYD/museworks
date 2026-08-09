import { beforeEach, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: electron.exposeInMainWorld },
  ipcRenderer: { invoke: electron.invoke },
}));

describe('preload bridge', () => {
  beforeEach(() => {
    electron.exposeInMainWorld.mockReset();
    electron.invoke.mockReset();
    vi.resetModules();
  });

  it('exposes only the named app.getInfo capability', async () => {
    electron.invoke.mockResolvedValue({ appVersion: '0.0.0', platform: 'win32', arch: 'x64' });

    await import('../src/preload/index.js');

    expect(electron.exposeInMainWorld).toHaveBeenCalledTimes(1);
    const [namespace, api] = electron.exposeInMainWorld.mock.calls[0] as [
      string,
      { app: { getInfo: () => Promise<unknown> } },
    ];
    expect(namespace).toBe('museworks');
    expect(Object.keys(api)).toEqual(['app']);
    expect(Object.keys(api.app)).toEqual(['getInfo']);
    await expect(api.app.getInfo()).resolves.toEqual({
      appVersion: '0.0.0',
      platform: 'win32',
      arch: 'x64',
    });
    expect(electron.invoke).toHaveBeenCalledWith('museworks:app:get-info');
  });

  it('rejects an invalid response from the main-process boundary', async () => {
    electron.invoke.mockResolvedValue({ appVersion: '0.0.0', platform: 'linux', arch: 'x64' });

    await import('../src/preload/index.js');

    const api = electron.exposeInMainWorld.mock.calls[0]?.[1] as {
      app: { getInfo: () => Promise<unknown> };
    };
    await expect(api.app.getInfo()).rejects.toThrow();
  });
});
