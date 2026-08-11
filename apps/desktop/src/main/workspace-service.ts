import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { basename, join, resolve } from 'node:path';

import {
  type Workspace,
  type WorkspaceSnapshot,
  workspaceIdSchema,
  workspaceSchema,
  workspaceSnapshotSchema,
} from '@museworks/contracts';

const MAX_RECENT_WORKSPACES = 10;
const STORE_VERSION = 1 as const;

interface WorkspaceFileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  stat(path: string): Promise<{ isDirectory(): boolean }>;
}

interface StoredWorkspaceState {
  version: typeof STORE_VERSION;
  activeWorkspaceId: string | null;
  recentWorkspaces: Workspace[];
}

interface WorkspaceServiceOptions {
  fileSystem: WorkspaceFileSystem;
  stateFilePath: string;
  createWorkspaceId: () => string;
  normalizePath: (path: string) => string;
  getBaseName: (path: string) => string;
}

export interface WorkspaceService {
  load(): Promise<WorkspaceSnapshot>;
  selectDirectory(path: string): Promise<WorkspaceSnapshot>;
  activate(workspaceId: string): Promise<WorkspaceSnapshot>;
}

export class InvalidWorkspaceError extends Error {
  constructor() {
    super('Workspace directory is unavailable');
    this.name = 'InvalidWorkspaceError';
  }
}

function emptyStoredState(): StoredWorkspaceState {
  return { version: STORE_VERSION, activeWorkspaceId: null, recentWorkspaces: [] };
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}

function parseStoredState(content: string): StoredWorkspaceState {
  try {
    const value = JSON.parse(content) as Record<string, unknown>;
    const recentWorkspaces = workspaceSnapshotSchema.safeParse({
      currentWorkspace: null,
      recentWorkspaces: value.recentWorkspaces,
    });
    const activeWorkspaceId =
      typeof value.activeWorkspaceId === 'string' || value.activeWorkspaceId === null
        ? value.activeWorkspaceId
        : undefined;

    if (
      value.version !== STORE_VERSION ||
      !recentWorkspaces.success ||
      activeWorkspaceId === undefined ||
      (activeWorkspaceId !== null && !workspaceIdSchema.safeParse(activeWorkspaceId).success)
    ) {
      return emptyStoredState();
    }

    return {
      version: STORE_VERSION,
      activeWorkspaceId,
      recentWorkspaces: recentWorkspaces.data.recentWorkspaces,
    };
  } catch {
    return emptyStoredState();
  }
}

export function createWorkspaceService(options: WorkspaceServiceOptions): WorkspaceService {
  async function readStoredState(): Promise<StoredWorkspaceState> {
    let storedState: StoredWorkspaceState;

    try {
      storedState = parseStoredState(await options.fileSystem.readFile(options.stateFilePath));
    } catch (error) {
      if (isMissingFileError(error)) {
        return emptyStoredState();
      }

      throw error;
    }

    const recentWorkspaces: Workspace[] = [];
    const rootPaths = new Set<string>();

    for (const workspace of storedState.recentWorkspaces) {
      try {
        const rootPath = options.normalizePath(workspace.rootPath);

        if (rootPaths.has(rootPath)) {
          continue;
        }

        recentWorkspaces.push(
          workspaceSchema.parse({
            id: workspace.id,
            name: options.getBaseName(rootPath) || rootPath,
            rootPath,
          }),
        );
        rootPaths.add(rootPath);
      } catch {
        // Records restored from userData cannot grant access until they are valid again.
      }
    }

    return {
      version: STORE_VERSION,
      activeWorkspaceId: recentWorkspaces.some(
        (workspace) => workspace.id === storedState.activeWorkspaceId,
      )
        ? storedState.activeWorkspaceId
        : null,
      recentWorkspaces,
    };
  }

  async function isDirectory(path: string): Promise<boolean> {
    try {
      return (await options.fileSystem.stat(path)).isDirectory();
    } catch (error) {
      if (isMissingFileError(error)) {
        return false;
      }

      throw error;
    }
  }

  async function snapshotFromState(state: StoredWorkspaceState): Promise<WorkspaceSnapshot> {
    const recentWorkspaces: Workspace[] = [];

    for (const workspace of state.recentWorkspaces) {
      if (await isDirectory(workspace.rootPath)) {
        recentWorkspaces.push(workspace);
      }
    }

    const currentWorkspace = recentWorkspaces.find(
      (workspace) => workspace.id === state.activeWorkspaceId,
    );

    return workspaceSnapshotSchema.parse({
      currentWorkspace: currentWorkspace ?? null,
      recentWorkspaces,
    });
  }

  async function writeStoredState(state: StoredWorkspaceState): Promise<void> {
    await options.fileSystem.writeFile(options.stateFilePath, JSON.stringify(state));
  }

  return {
    async load() {
      return snapshotFromState(await readStoredState());
    },

    async selectDirectory(path) {
      let rootPath: string;

      try {
        rootPath = options.normalizePath(path);
      } catch {
        throw new InvalidWorkspaceError();
      }

      if (!(await isDirectory(rootPath))) {
        throw new InvalidWorkspaceError();
      }

      const state = await readStoredState();
      const existingWorkspace = state.recentWorkspaces.find(
        (workspace) => workspace.rootPath === rootPath,
      );
      const workspace = workspaceSchema.parse({
        id: existingWorkspace?.id ?? options.createWorkspaceId(),
        name: options.getBaseName(rootPath) || rootPath,
        rootPath,
      });
      const recentWorkspaces = [
        workspace,
        ...state.recentWorkspaces.filter(
          (recentWorkspace) => recentWorkspace.rootPath !== rootPath,
        ),
      ].slice(0, MAX_RECENT_WORKSPACES);
      const nextState: StoredWorkspaceState = {
        version: STORE_VERSION,
        activeWorkspaceId: workspace.id,
        recentWorkspaces,
      };

      await writeStoredState(nextState);
      return snapshotFromState(nextState);
    },

    async activate(workspaceId) {
      const state = await readStoredState();
      const workspace = state.recentWorkspaces.find(
        (recentWorkspace) => recentWorkspace.id === workspaceId,
      );

      if (!workspace || !(await isDirectory(workspace.rootPath))) {
        throw new InvalidWorkspaceError();
      }

      const nextState: StoredWorkspaceState = {
        version: STORE_VERSION,
        activeWorkspaceId: workspace.id,
        recentWorkspaces: [
          workspace,
          ...state.recentWorkspaces.filter(
            (recentWorkspace) => recentWorkspace.id !== workspace.id,
          ),
        ],
      };

      await writeStoredState(nextState);
      return snapshotFromState(nextState);
    },
  };
}

export function createUserDataWorkspaceService(userDataPath: string): WorkspaceService {
  return createWorkspaceService({
    fileSystem: {
      readFile: (path) => fs.readFile(path, 'utf8'),
      writeFile: (path, content) => fs.writeFile(path, content, 'utf8'),
      stat: (path) => fs.stat(path),
    },
    stateFilePath: join(userDataPath, 'workspace-state.json'),
    createWorkspaceId: randomUUID,
    normalizePath: resolve,
    getBaseName: basename,
  });
}
