import { app, BrowserWindow, screen } from 'electron';
import path from 'path';
import fs from 'fs';

/**
 * Window Manager
 * 
 * Manages the main application window with robust path resolution
 * that works reliably across development, production, installed, and portable modes.
 */
export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  
  /**
   * Detect development vs production mode.
   *
   * Dev mode requires BOTH:
   *   1. `app.isPackaged` is false (not running from Setup.exe / Portable.exe), AND
   *   2. `VITE_DEV_SERVER_URL` is set (Vite dev server is running).
   *
   * This lets `npm start` (which just runs `electron .` against the built
   * dist/renderer output) behave like a production run without needing to
   * package the app first.
   */
  private isDev(): boolean {
    return !app.isPackaged && !!process.env.VITE_DEV_SERVER_URL;
  }
  
  /**
   * Resolve the preload script path.
   * 
   * Preload is compiled to the same directory as this file (main/preload.js).
   * __dirname resolves correctly in both dev and packaged modes because
   * it always points to the runtime location of the compiled JS.
   */
  private getPreloadPath(): string {
    return path.join(__dirname, 'preload.js');
  }
  
  /**
   * Resolve the renderer HTML path.
   *
   * Uses `app.getAppPath()` which reliably returns:
   * - Dev / `npm start`: the project root (where package.json lives)
   * - Packaged: /path/to/resources/app.asar (the ASAR root)
   *
   * The renderer is always built to `dist/renderer/index.html` relative
   * to the app root, so this works regardless of packaging format.
   */
  private getRendererPath(): string {
    const appPath = app.getAppPath();
    const primary = path.join(appPath, 'dist', 'renderer', 'index.html');
    if (fs.existsSync(primary)) return primary;

    // Fallback: unusual electron-builder layouts. Walk up from the compiled
    // main directory (dist/main/main) to reach dist/renderer/index.html.
    const fallback = path.resolve(__dirname, '..', '..', 'renderer', 'index.html');
    if (fs.existsSync(fallback)) return fallback;

    // Return primary path so Electron surfaces a clear file-not-found error.
    return primary;
  }
  
  createMainWindow(): BrowserWindow {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    
    this.mainWindow = new BrowserWindow({
      width: Math.min(1600, width),
      height: Math.min(1000, height),
      minWidth: 1366,
      minHeight: 768,
      title: 'Live Deposit Monitor',
      backgroundColor: '#1a1a1a',
      show: false, // Show only after content is ready to prevent white flash
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this.getPreloadPath()
      }
    });
    
    // Load renderer based on packaging state (not on unreliable env vars)
    if (this.isDev()) {
      const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
      this.mainWindow.loadURL(devUrl);
      this.mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
      const rendererPath = this.getRendererPath();
      this.mainWindow.loadFile(rendererPath);
    }
    
    // Show window when content is ready (avoids blank window flash)
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });
    
    // Minimize to tray instead of closing
    this.mainWindow.on('close', (event) => {
      if (!(global as any).isQuitting) {
        event.preventDefault();
        this.mainWindow?.hide();
      }
    });
    
    return this.mainWindow;
  }
  
  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }
  
  show(): void {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) this.mainWindow.restore();
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }
  
  hide(): void {
    this.mainWindow?.hide();
  }
  
  sendToRenderer(channel: string, ...args: any[]): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, ...args);
    }
  }
}
