import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RunMode } from '@verdent-mini/core';
import { setupLocalMode } from './modes/local.js';
import { setupRemoteMode } from './modes/remote.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get mode from environment
const mode = (process.env.AGENT_MODE || 'local') as RunMode;
const remoteUrl = process.env.REMOTE_URL || 'ws://localhost:3001/ws';

let mainWindow: BrowserWindow | null = null;
let cleanup: (() => void) | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      // Use .cjs for preload - Electron preload scripts require CommonJS format
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0a0f',
  });

  // Setup mode
  if (mode === 'local') {
    const local = setupLocalMode();
    cleanup = local.cleanup;
    console.log('Running in LOCAL mode');
  } else if (mode === 'remote') {
    const remote = setupRemoteMode(remoteUrl);
    cleanup = remote.cleanup;
    
    try {
      await remote.connect();
      console.log('Running in REMOTE mode, connected to:', remoteUrl);
    } catch (error) {
      console.error('Failed to connect to remote server:', error);
    }
  }

  // Load the frontend
  if (process.env.VITE_DEV_SERVER_URL) {
    // Development: load from Vite dev server
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load built files
    const frontendPath = path.join(__dirname, '../../frontend/dist/index.html');
    await mainWindow.loadFile(frontendPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  cleanup?.();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle app quit
app.on('before-quit', () => {
  cleanup?.();
});
