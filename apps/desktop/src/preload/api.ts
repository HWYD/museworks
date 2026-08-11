import {
  appInfoSchema,
  IPC_ACTIVATE_WORKSPACE,
  IPC_GET_APP_INFO,
  IPC_LOAD_WORKSPACE,
  IPC_PICK_WORKSPACE,
  type AppInfo,
  type WorkspaceLoadResult,
  type WorkspaceSelectionResult,
  workspaceActivationRequestSchema,
  workspaceLoadResultSchema,
  workspaceSelectionResultSchema,
} from '@museworks/contracts';

export interface MuseworksApi {
  app: {
    getInfo(): Promise<AppInfo>;
  };
  workspace: {
    load(): Promise<WorkspaceLoadResult>;
    pick(): Promise<WorkspaceSelectionResult>;
    activate(workspaceId: string): Promise<WorkspaceSelectionResult>;
  };
}

interface InvokeCapability {
  invoke(channel: typeof IPC_GET_APP_INFO): Promise<unknown>;
  invoke(channel: typeof IPC_LOAD_WORKSPACE): Promise<unknown>;
  invoke(channel: typeof IPC_PICK_WORKSPACE): Promise<unknown>;
  invoke(channel: typeof IPC_ACTIVATE_WORKSPACE, input: unknown): Promise<unknown>;
}

export function createMuseworksApi(ipc: InvokeCapability): MuseworksApi {
  return {
    app: {
      async getInfo() {
        return appInfoSchema.parse(await ipc.invoke(IPC_GET_APP_INFO));
      },
    },
    workspace: {
      async load() {
        return workspaceLoadResultSchema.parse(await ipc.invoke(IPC_LOAD_WORKSPACE));
      },
      async pick() {
        return workspaceSelectionResultSchema.parse(await ipc.invoke(IPC_PICK_WORKSPACE));
      },
      async activate(workspaceId) {
        const request = workspaceActivationRequestSchema.parse({ workspaceId });
        return workspaceSelectionResultSchema.parse(
          await ipc.invoke(IPC_ACTIVATE_WORKSPACE, request),
        );
      },
    },
  };
}
