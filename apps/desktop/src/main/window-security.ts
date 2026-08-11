interface NavigationEvent {
  preventDefault(): void;
}

interface SessionSecurityCapability {
  setPermissionRequestHandler(
    handler: (
      webContents: unknown,
      permission: string,
      callback: (granted: boolean) => void,
    ) => void,
  ): void;
  setPermissionCheckHandler(
    handler: (webContents: unknown, permission: string, requestingOrigin: string) => boolean,
  ): void;
}

interface WindowSecurityCapability {
  setWindowOpenHandler(handler: (details: unknown) => { action: 'deny' }): void;
  on(event: 'will-navigate', listener: (event: NavigationEvent, url: string) => void): void;
  session: SessionSecurityCapability;
}

function isTrustedNavigation(navigationUrl: string, entryUrl: string): boolean {
  try {
    const navigationTarget = new URL(navigationUrl);
    const entryTarget = new URL(entryUrl);

    return entryTarget.protocol === 'file:'
      ? navigationTarget.href === entryTarget.href
      : navigationTarget.origin === entryTarget.origin;
  } catch {
    return false;
  }
}

export function configureWindowSecurity(
  webContents: WindowSecurityCapability,
  entryUrl: string,
): void {
  webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  webContents.on('will-navigate', (event, navigationUrl) => {
    if (!isTrustedNavigation(navigationUrl, entryUrl)) {
      event.preventDefault();
    }
  });
  webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  webContents.session.setPermissionCheckHandler(() => false);
}
