import { contextBridge, ipcRenderer } from 'electron';

/**
 * Store mapping between user callbacks and IPC subscriptions
 */
const listenerMap = new Map<(data: string) => void, (event: Electron.IpcRendererEvent, data: string) => void>();

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
    listenerMap.set(callback, subscription);
    ipcRenderer.on(channel, subscription);
  },
  removeListener: (channel: string, callback: (data: string) => void) => {
    const subscription = listenerMap.get(callback);
    if (subscription) {
      ipcRenderer.removeListener(channel, subscription);
      listenerMap.delete(callback);
    }
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
