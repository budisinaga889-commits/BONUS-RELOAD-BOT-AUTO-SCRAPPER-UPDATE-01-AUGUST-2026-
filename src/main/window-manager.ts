import { app, BrowserWindow, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import { AppDirectoryManager } from './services/app-directory-manager';

/**
 * Window Manager
 *
 * Manages the main application window with robust path resolution
 * that works reliably across development, production, installed, and portable modes.
 *
 * Iteration 11 addition (UI-only): window bounds persistence. Reads/writes a
 * `ui-state.json` file in the app config directory containing the window
 * position, size, and maximized flag. If the file is missing or corrupt, the
 * historical defaults (1600x1000 centered by Electron) are used byte-for-byte
 * — so this is a strictly additive change with a robust fallback.
 */

interface WindowState {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  isMaximized?: boolean;
}

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private appDirManager: AppDirectoryManager | null = null;
  private saveTimer: NodeJS.Timeout | null = null;

  /**
   * Optional wiring: pass the AppDirectoryManager so we can persist window bounds.
   * If not provided, the window still opens with sane defaults — nothing else changes.
   */
  setAppDirManager(appDirManager: AppDirectoryManager) {
    this.appDirManager = appDirManager;
  }

  private isDev(): boolean {
    return !app.isPackaged && !!process.env.VITE_DEV_SERVER_URL;
  }

  private getPreloadPath(): string {
    return path.join(__dirname, 'preload.js');
  }

  private getRendererPath(): string {
    const appPath = app.getAppPath();
    const primary = path.join(appPath, 'dist', 'renderer', 'index.html');
    if (fs.existsSync(primary)) return primary;
    const fallback = path.resolve(__dirname, '..', '..', 'renderer', 'index.html');
    if (fs.existsSync(fallback)) return fallback;
    return primary;
  }

  private loadState(): WindowState | null {
    if (!this.appDirManager) return null;
    try {
      const p = this.appDirManager.getUiStatePath();
      if (!fs.existsSync(p)) return null;
      const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
      return raw && typeof raw === 'object' && raw.window ? raw.window as WindowState : null;
    } catch {
      return null;
    }
  }

  private saveState(state: WindowState): void {
    if (!this.appDirManager) return;
    try {
      const p = this.appDirManager.getUiStatePath();
      // Preserve any non-window fields already present in the file.
      let existing: any = {};
      if (fs.existsSync(p)) {
        try { existing = JSON.parse(fs.readFileSync(p, 'utf8')) || {}; } catch { existing = {}; }
      }
      existing.window = state;
      fs.writeFileSync(p, JSON.stringify(existing, null, 2), 'utf8');
    } catch {
      /* non-fatal — window state persistence is best-effort */
    }
  }

  private scheduleSave(): void {
    if (!this.mainWindow) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
      const isMaximized = this.mainWindow.isMaximized();
      const bounds = isMaximized ? this.mainWindow.getNormalBounds() : this.mainWindow.getBounds();
      this.saveState({ ...bounds, isMaximized });
    }, 300);
  }

  /**
   * Clamp a saved bounds object so it always lands on a currently-connected
   * display. Prevents restoring the window off-screen when the operator
   * unplugged the external monitor between sessions.
   */
  private clampToDisplays(state: WindowState): WindowState {
    const displays = screen.getAllDisplays();
    if (state.x === undefined || state.y === undefined || state.width === undefined || state.height === undefined) {
      return state;
    }
    const fitsSomewhere = displays.some(d => {
      const b = d.workArea;
      return state.x! >= b.x && state.y! >= b.y &&
             state.x! + state.width! <= b.x + b.width &&
             state.y! + state.height! <= b.y + b.height;
    });
    return fitsSomewhere ? state : { width: state.width, height: state.height, isMaximized: state.isMaximized };
  }

  createMainWindow(): BrowserWindow {
    const primary = screen.getPrimaryDisplay().workAreaSize;
    const savedRaw = this.loadState();
    const saved = savedRaw ? this.clampToDisplays(savedRaw) : null;

    const width  = saved?.width  ?? Math.min(1600, primary.width);
    const height = saved?.height ?? Math.min(1000, primary.height);

    this.mainWindow = new BrowserWindow({
      width,
      height,
      x: saved?.x,
      y: saved?.y,
      minWidth: 1366,
      minHeight: 768,
      title: 'Live Deposit Monitor',
      backgroundColor: '#1a1a1a',
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this.getPreloadPath()
      }
    });

    if (saved?.isMaximized) {
      this.mainWindow.maximize();
    }

    if (this.isDev()) {
      const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
      this.mainWindow.loadURL(devUrl);
      this.mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
      this.mainWindow.loadFile(this.getRendererPath());
    }

    this.mainWindow.once('ready-to-show', () => this.mainWindow?.show());

    // Persist bounds/state changes (debounced).
    this.mainWindow.on('resize', () => this.scheduleSave());
    this.mainWindow.on('move',   () => this.scheduleSave());
    this.mainWindow.on('maximize',   () => this.scheduleSave());
    this.mainWindow.on('unmaximize', () => this.scheduleSave());

    // Minimize to tray instead of closing (existing behaviour).
    this.mainWindow.on('close', (event) => {
      // Flush the latest bounds synchronously before hiding.
      if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        const isMaximized = this.mainWindow.isMaximized();
        const bounds = isMaximized ? this.mainWindow.getNormalBounds() : this.mainWindow.getBounds();
        this.saveState({ ...bounds, isMaximized });
      }
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
