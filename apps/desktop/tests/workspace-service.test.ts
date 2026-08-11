import { describe, expect, it, vi } from 'vitest';

import { InvalidWorkspaceError, createWorkspaceService } from '../src/main/workspace-service.js';

const workspaceId = '9f5f4e2e-08cb-41bc-99ff-e5a347bfebc7';
const rootPath = 'D:\\MuseWorks\\summer-coffee';

function createMemoryFileSystem(initialState: string | undefined, validPaths: Set<string>) {
  let state = initialState;

  return {
    readFile: vi.fn(async () => {
      if (state === undefined) {
        const error = Object.assign(new Error('missing'), { code: 'ENOENT' });
        throw error;
      }

      return state;
    }),
    writeFile: vi.fn(async (_path: string, content: string) => {
      state = content;
    }),
    stat: vi.fn(async (path: string) => ({ isDirectory: () => validPaths.has(path) })),
  };
}

describe('workspace service', () => {
  it('creates a current Workspace from a validated user-selected directory and persists it', async () => {
    const fileSystem = createMemoryFileSystem(undefined, new Set([rootPath]));
    const service = createWorkspaceService({
      fileSystem,
      stateFilePath: 'D:\\user-data\\workspace-state.json',
      createWorkspaceId: () => workspaceId,
      normalizePath: (path) => path,
      getBaseName: () => 'summer-coffee',
    });

    await expect(service.selectDirectory(rootPath)).resolves.toEqual({
      currentWorkspace: { id: workspaceId, name: 'summer-coffee', rootPath },
      recentWorkspaces: [{ id: workspaceId, name: 'summer-coffee', rootPath }],
    });
    expect(fileSystem.writeFile).toHaveBeenCalledWith(
      'D:\\user-data\\workspace-state.json',
      expect.stringContaining('summer-coffee'),
    );
  });

  it('deduplicates a reselected workspace and activates a recent workspace by id', async () => {
    const fileSystem = createMemoryFileSystem(undefined, new Set([rootPath]));
    const service = createWorkspaceService({
      fileSystem,
      stateFilePath: 'workspace-state.json',
      createWorkspaceId: () => workspaceId,
      normalizePath: (path) => path,
      getBaseName: () => 'summer-coffee',
    });

    await service.selectDirectory(rootPath);
    await service.selectDirectory(rootPath);

    await expect(service.activate(workspaceId)).resolves.toMatchObject({
      currentWorkspace: { id: workspaceId },
      recentWorkspaces: [{ id: workspaceId }],
    });
  });

  it('rejects a missing or non-directory Workspace without persisting it', async () => {
    const fileSystem = createMemoryFileSystem(undefined, new Set());
    const service = createWorkspaceService({
      fileSystem,
      stateFilePath: 'workspace-state.json',
      createWorkspaceId: () => workspaceId,
      normalizePath: (path) => path,
      getBaseName: () => 'missing',
    });

    await expect(service.selectDirectory('D:\\MuseWorks\\missing')).rejects.toBeInstanceOf(
      InvalidWorkspaceError,
    );
    expect(fileSystem.writeFile).not.toHaveBeenCalled();
  });

  it('normalizes restored Workspace paths and rebuilds their display names', async () => {
    const storedPath = 'D:\\MuseWorks\\draft\\..\\summer-coffee';
    const fileSystem = createMemoryFileSystem(
      JSON.stringify({
        version: 1,
        activeWorkspaceId: workspaceId,
        recentWorkspaces: [{ id: workspaceId, name: 'outdated-name', rootPath: storedPath }],
      }),
      new Set([rootPath]),
    );
    const service = createWorkspaceService({
      fileSystem,
      stateFilePath: 'workspace-state.json',
      createWorkspaceId: () => workspaceId,
      normalizePath: (path) => path.replace('\\draft\\..', ''),
      getBaseName: (path) => path.split('\\').pop() ?? '',
    });

    await expect(service.load()).resolves.toEqual({
      currentWorkspace: { id: workspaceId, name: 'summer-coffee', rootPath },
      recentWorkspaces: [{ id: workspaceId, name: 'summer-coffee', rootPath }],
    });
  });

  it('surfaces unexpected storage failures instead of treating them as empty state', async () => {
    const fileSystem = createMemoryFileSystem(undefined, new Set([rootPath]));
    fileSystem.readFile.mockRejectedValueOnce(new Error('user data unavailable'));
    const service = createWorkspaceService({
      fileSystem,
      stateFilePath: 'workspace-state.json',
      createWorkspaceId: () => workspaceId,
      normalizePath: (path) => path,
      getBaseName: () => 'summer-coffee',
    });

    await expect(service.load()).rejects.toThrow('user data unavailable');
  });

  it('surfaces unexpected directory validation failures instead of treating them as missing', async () => {
    const fileSystem = createMemoryFileSystem(
      JSON.stringify({
        version: 1,
        activeWorkspaceId: workspaceId,
        recentWorkspaces: [{ id: workspaceId, name: 'summer-coffee', rootPath }],
      }),
      new Set([rootPath]),
    );
    fileSystem.stat.mockRejectedValueOnce(new Error('directory access unavailable'));
    const service = createWorkspaceService({
      fileSystem,
      stateFilePath: 'workspace-state.json',
      createWorkspaceId: () => workspaceId,
      normalizePath: (path) => path,
      getBaseName: () => 'summer-coffee',
    });

    await expect(service.load()).rejects.toThrow('directory access unavailable');
  });
});
