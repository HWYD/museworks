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

  it('exposes only the named app and workspace capabilities', async () => {
    electron.invoke.mockResolvedValue({ appVersion: '0.0.0', platform: 'win32', arch: 'x64' });

    await import('../src/preload/index.js');

    expect(electron.exposeInMainWorld).toHaveBeenCalledTimes(1);
    const [namespace, api] = electron.exposeInMainWorld.mock.calls[0] as [
      string,
      {
        app: { getInfo: () => Promise<unknown> };
        workspace: {
          load: () => Promise<unknown>;
          pick: () => Promise<unknown>;
          activate: (workspaceId: string) => Promise<unknown>;
        };
      },
    ];
    expect(namespace).toBe('museworks');
    expect(Object.keys(api)).toEqual(['app', 'workspace']);
    expect(Object.keys(api.app)).toEqual(['getInfo']);
    expect(Object.keys(api.workspace)).toEqual(['load', 'pick', 'activate']);
    await expect(api.app.getInfo()).resolves.toEqual({
      appVersion: '0.0.0',
      platform: 'win32',
      arch: 'x64',
    });
    expect(electron.invoke).toHaveBeenCalledWith('museworks:app:get-info');
  });

  it('validates named Workspace requests and results', async () => {
    const workspace = {
      id: '9f5f4e2e-08cb-41bc-99ff-e5a347bfebc7',
      name: 'summer-coffee',
      rootPath: 'D:\\MuseWorks\\summer-coffee',
    };
    electron.invoke
      .mockResolvedValueOnce({
        status: 'loaded',
        snapshot: { currentWorkspace: null, recentWorkspaces: [workspace] },
      })
      .mockResolvedValueOnce({
        status: 'selected',
        snapshot: { currentWorkspace: workspace, recentWorkspaces: [workspace] },
      })
      .mockResolvedValueOnce({ status: 'cancelled' });

    await import('../src/preload/index.js');

    const api = electron.exposeInMainWorld.mock.calls[0]?.[1] as {
      workspace: {
        load: () => Promise<unknown>;
        activate: (workspaceId: string) => Promise<unknown>;
        pick: () => Promise<unknown>;
      };
    };
    await expect(api.workspace.load()).resolves.toEqual({
      status: 'loaded',
      snapshot: { currentWorkspace: null, recentWorkspaces: [workspace] },
    });
    await expect(api.workspace.activate(workspace.id)).resolves.toMatchObject({
      status: 'selected',
    });
    await expect(api.workspace.pick()).resolves.toEqual({ status: 'cancelled' });
    expect(electron.invoke).toHaveBeenNthCalledWith(1, 'museworks:workspace:load');
    expect(electron.invoke).toHaveBeenNthCalledWith(2, 'museworks:workspace:activate', {
      workspaceId: workspace.id,
    });
    expect(electron.invoke).toHaveBeenNthCalledWith(3, 'museworks:workspace:pick');
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
