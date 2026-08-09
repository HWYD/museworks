import { appInfoSchema, IPC_GET_APP_INFO, type AppInfo } from '@museworks/contracts';

export interface MuseworksApi {
  app: {
    getInfo(): Promise<AppInfo>;
  };
}

interface InvokeCapability {
  invoke(channel: typeof IPC_GET_APP_INFO): Promise<unknown>;
}

export function createMuseworksApi(ipc: InvokeCapability): MuseworksApi {
  return {
    app: {
      async getInfo() {
        return appInfoSchema.parse(await ipc.invoke(IPC_GET_APP_INFO));
      },
    },
  };
}
