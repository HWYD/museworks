import { describe, expect, it, vi } from 'vitest';

import {
  IPC_ACTIVATE_WORKSPACE,
  IPC_LOAD_WORKSPACE,
  IPC_PICK_WORKSPACE,
  type WorkspaceSnapshot,
} from '@museworks/contracts';

import { InvalidWorkspaceError } from '../src/main/workspace-service.js';
import { registerWorkspaceHandlers } from '../src/main/workspace-ipc.js';

const workspaceId = '9f5f4e2e-08cb-41bc-99ff-e5a347bfebc7';
const snapshot: WorkspaceSnapshot = {
  currentWorkspace: {
    id: workspaceId,
    name: 'summer-coffee',
    rootPath: 'D:\\MuseWorks\\summer-coffee',
  },
  recentWorkspaces: [
    { id: workspaceId, name: 'summer-coffee', rootPath: 'D:\\MuseWorks\\summer-coffee' },
  ],
};

describe('workspace main-process IPC', () => {
  it('registers only named workspace handlers and maps a native dialog cancellation', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const service = {
      load: vi.fn(async () => snapshot),
      selectDirectory: vi.fn(async () => snapshot),
      activate: vi.fn(async () => snapshot),
    };

    registerWorkspaceHandlers(
      { handle: (channel, handler) => handlers.set(channel, handler) },
      { showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })) },
      service,
    );

    expect([...handlers.keys()]).toEqual([
      IPC_LOAD_WORKSPACE,
      IPC_PICK_WORKSPACE,
      IPC_ACTIVATE_WORKSPACE,
    ]);
    await expect(handlers.get(IPC_PICK_WORKSPACE)?.()).resolves.toEqual({ status: 'cancelled' });
    expect(service.selectDirectory).not.toHaveBeenCalled();
  });

  it('selects a single directory and rejects invalid recent Workspace requests safely', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const service = {
      load: vi.fn(async () => snapshot),
      selectDirectory: vi.fn(async () => snapshot),
      activate: vi.fn(async () => {
        throw new InvalidWorkspaceError();
      }),
    };
    const showOpenDialog = vi.fn(async () => ({
      canceled: false,
      filePaths: ['D:\\MuseWorks\\summer-coffee'],
    }));

    registerWorkspaceHandlers(
      { handle: (channel, handler) => handlers.set(channel, handler) },
      { showOpenDialog },
      service,
    );

    await expect(handlers.get(IPC_LOAD_WORKSPACE)?.()).resolves.toEqual({
      status: 'loaded',
      snapshot,
    });
    await expect(handlers.get(IPC_PICK_WORKSPACE)?.()).resolves.toEqual({
      status: 'selected',
      snapshot,
    });
    await expect(
      handlers.get(IPC_ACTIVATE_WORKSPACE)?.({}, { workspaceId: 'invalid' }),
    ).resolves.toEqual({
      status: 'error',
      code: 'invalid-workspace',
    });
    expect(showOpenDialog).toHaveBeenCalledWith({ properties: ['openDirectory'] });
    expect(service.selectDirectory).toHaveBeenCalledWith('D:\\MuseWorks\\summer-coffee');
  });

  it('maps a rejected native directory dialog to a safe Workspace error result', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const service = {
      load: vi.fn(async () => snapshot),
      selectDirectory: vi.fn(async () => snapshot),
      activate: vi.fn(async () => snapshot),
    };

    registerWorkspaceHandlers(
      { handle: (channel, handler) => handlers.set(channel, handler) },
      { showOpenDialog: vi.fn(async () => Promise.reject(new Error('dialog unavailable'))) },
      service,
    );

    await expect(handlers.get(IPC_PICK_WORKSPACE)?.()).resolves.toEqual({
      status: 'error',
      code: 'workspace-storage-unavailable',
    });
    expect(service.selectDirectory).not.toHaveBeenCalled();
  });

  it('maps a Workspace load failure to a safe error result', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const service = {
      load: vi.fn(async () => Promise.reject(new Error('user data unavailable'))),
      selectDirectory: vi.fn(async () => snapshot),
      activate: vi.fn(async () => snapshot),
    };

    registerWorkspaceHandlers(
      { handle: (channel, handler) => handlers.set(channel, handler) },
      { showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })) },
      service,
    );

    await expect(handlers.get(IPC_LOAD_WORKSPACE)?.()).resolves.toEqual({
      status: 'error',
      code: 'workspace-storage-unavailable',
    });
  });
});
