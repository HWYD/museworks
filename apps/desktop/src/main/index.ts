import { join } from 'node:path';

import { app, BrowserWindow, ipcMain } from 'electron';
import squirrelStartup from 'electron-squirrel-startup';

import { registerAppInfoHandler } from './app-info.js';
import { createWindowOptions } from './window.js';

function createWindow(): BrowserWindow {
  const window = new BrowserWindow(createWindowOptions(join(__dirname, 'preload.js')));

  window.once('ready-to-show', () => window.show());

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

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
