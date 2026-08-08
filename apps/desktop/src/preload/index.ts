import { contextBridge, ipcRenderer } from 'electron';

import { createMuseworksApi } from './api.js';

contextBridge.exposeInMainWorld('museworks', createMuseworksApi(ipcRenderer));
