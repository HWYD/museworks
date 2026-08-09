import { appInfoSchema, IPC_GET_APP_INFO, type AppInfo } from '@museworks/contracts';

interface IpcMainCapability {
  handle(channel: string, listener: () => unknown): void;
}

interface AppVersionCapability {
  getVersion(): string;
}

interface RuntimeIdentity {
  platform: string;
  arch: string;
}

function narrowPlatform(value: string): AppInfo['platform'] {
  if (value === 'win32' || value === 'darwin') {
    return value;
  }

  throw new Error(`Unsupported platform: ${value}`);
}

function narrowArch(value: string): AppInfo['arch'] {
  if (value === 'x64' || value === 'arm64') {
    return value;
  }

  throw new Error(`Unsupported architecture: ${value}`);
}

export function createAppInfo(appVersion: string, platform: string, arch: string): AppInfo {
  return appInfoSchema.parse({
    appVersion,
    platform: narrowPlatform(platform),
    arch: narrowArch(arch),
  });
}

export function registerAppInfoHandler(
  ipcMain: IpcMainCapability,
  app: AppVersionCapability,
  runtime: RuntimeIdentity,
): void {
  ipcMain.handle(IPC_GET_APP_INFO, () =>
    createAppInfo(app.getVersion(), runtime.platform, runtime.arch),
  );
}
