import { contextBridge, ipcRenderer } from 'electron';

/**
 * Expose IPC API to renderer process
 */
contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel: string, data: string) => {
    ipcRenderer.send(channel, data);
  },
  on: (channel: string, callback: (data: string) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, data: string) => {
      callback(data);
    };
    ipcRenderer.on(channel, subscription);
  },
  removeListener: (channel: string, callback: (data: string) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
});

// Type declaration for renderer
declare global {
  interface Window {
    electronAPI: {
      send: (channel: string, data: string) => void;
      on: (channel: string, callback: (data: string) => void) => void;
      removeListener: (channel: string, callback: (data: string) => void) => void;
    };
  }
}
