import {
  IPC_ACTIVATE_WORKSPACE,
  IPC_LOAD_WORKSPACE,
  IPC_PICK_WORKSPACE,
  type WorkspaceLoadResult,
  type WorkspaceSelectionResult,
  workspaceActivationRequestSchema,
  workspaceLoadResultSchema,
  workspaceSelectionResultSchema,
} from '@museworks/contracts';

import { InvalidWorkspaceError, type WorkspaceService } from './workspace-service.js';

interface IpcMainCapability {
  handle(channel: string, listener: (...args: unknown[]) => unknown): void;
}

interface NativeDirectoryDialog {
  showOpenDialog(options: { properties: ['openDirectory'] }): Promise<{
    canceled: boolean;
    filePaths: string[];
  }>;
}

function errorResult(error: unknown): WorkspaceSelectionResult {
  return workspaceSelectionResultSchema.parse({
    status: 'error',
    code:
      error instanceof InvalidWorkspaceError
        ? 'invalid-workspace'
        : 'workspace-storage-unavailable',
  });
}

function loadErrorResult(): WorkspaceLoadResult {
  return workspaceLoadResultSchema.parse({
    status: 'error',
    code: 'workspace-storage-unavailable',
  });
}

async function selectResult(
  operation: () => Promise<Awaited<ReturnType<WorkspaceService['load']>>>,
): Promise<WorkspaceSelectionResult> {
  try {
    return workspaceSelectionResultSchema.parse({
      status: 'selected',
      snapshot: await operation(),
    });
  } catch (error) {
    return errorResult(error);
  }
}

export function registerWorkspaceHandlers(
  ipcMain: IpcMainCapability,
  dialog: NativeDirectoryDialog,
  workspaceService: WorkspaceService,
): void {
  ipcMain.handle(IPC_LOAD_WORKSPACE, async () => {
    try {
      return workspaceLoadResultSchema.parse({
        status: 'loaded',
        snapshot: await workspaceService.load(),
      });
    } catch {
      return loadErrorResult();
    }
  });
  ipcMain.handle(IPC_PICK_WORKSPACE, async () => {
    let result: Awaited<ReturnType<NativeDirectoryDialog['showOpenDialog']>>;

    try {
      result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    } catch (error) {
      return errorResult(error);
    }

    if (result.canceled) {
      return workspaceSelectionResultSchema.parse({ status: 'cancelled' });
    }

    if (result.filePaths.length !== 1) {
      return errorResult(new InvalidWorkspaceError());
    }

    return selectResult(() => workspaceService.selectDirectory(result.filePaths[0] ?? ''));
  });
  ipcMain.handle(IPC_ACTIVATE_WORKSPACE, async (_event, input) => {
    const request = workspaceActivationRequestSchema.safeParse(input);

    if (!request.success) {
      return errorResult(new InvalidWorkspaceError());
    }

    return selectResult(() => workspaceService.activate(request.data.workspaceId));
  });
}
