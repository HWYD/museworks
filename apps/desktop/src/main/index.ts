import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import squirrelStartup from 'electron-squirrel-startup';

import { registerAppInfoHandler } from './app-info.js';
import { createWindowOptions } from './window.js';
import { registerWorkspaceHandlers } from './workspace-ipc.js';
import { createUserDataWorkspaceService } from './workspace-service.js';
import { configureWindowSecurity } from './window-security.js';

function createWindow(): BrowserWindow {
  const window = new BrowserWindow(createWindowOptions(join(__dirname, 'preload.js')));
  const rendererEntryUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL
    ? MAIN_WINDOW_VITE_DEV_SERVER_URL
    : pathToFileURL(join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)).toString();

  configureWindowSecurity(window.webContents, rendererEntryUrl);

  window.once('ready-to-show', () => window.show());
  void window.loadURL(rendererEntryUrl);

  return window;
}

if (squirrelStartup) {
  app.quit();
} else {
  app.whenReady().then(() => {
    registerAppInfoHandler(
      {
        handle: (channel, listener) => {
          ipcMain.handle(channel, listener);
        },
      },
      app,
      process,
    );
    registerWorkspaceHandlers(
      {
        handle: (channel, listener) => {
          ipcMain.handle(channel, listener);
        },
      },
      dialog,
      createUserDataWorkspaceService(app.getPath('userData')),
    );
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
