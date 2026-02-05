import { ipcMain } from 'electron';
import WebSocket from 'ws';

/**
 * Setup remote mode
 * Forwards RPC calls to a remote server via WebSocket
 */
export function setupRemoteMode(
  remoteUrl: string
): { connect: () => Promise<void>; cleanup: () => void } {
  let ws: WebSocket | null = null;
  let connected = false;
  const pendingMessages: string[] = [];

  // Map to track responses for each request
  const ipcSenders = new Map<string, Electron.WebContents>();

  const connect = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      ws = new WebSocket(remoteUrl);

      ws.on('open', () => {
        console.log('Connected to remote server:', remoteUrl);
        connected = true;

        // Send any pending messages
        while (pendingMessages.length > 0) {
          const msg = pendingMessages.shift();
          if (msg) ws.send(msg);
        }

        resolve();
      });

      ws.on('message', (data) => {
        const message = data.toString();
        
        // Forward response to all renderer processes
        // In a real app, you'd track which renderer sent each request
        ipcSenders.forEach((sender) => {
          if (!sender.isDestroyed()) {
            sender.send('rpc-response', message);
          }
        });
      });

      ws.on('close', () => {
        console.log('Disconnected from remote server');
        connected = false;
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      });
    });
  };

  // Handle IPC messages and forward to WebSocket
  const handleRPCMessage = (event: Electron.IpcMainEvent, data: string) => {
    // Track sender for responses
    try {
      const request = JSON.parse(data);
      ipcSenders.set(String(request.id), event.sender);
    } catch {
      // Ignore parse errors
    }

    if (connected && ws?.readyState === WebSocket.OPEN) {
      ws.send(data);
    } else {
      pendingMessages.push(data);
    }
  };

  ipcMain.on('rpc', handleRPCMessage);

  console.log('Remote mode initialized, will connect to:', remoteUrl);

  return {
    connect,
    cleanup: () => {
      ipcMain.removeListener('rpc', handleRPCMessage);
      ws?.close();
      ws = null;
      ipcSenders.clear();
    },
  };
}
