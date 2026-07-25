import { Tray, Menu, nativeImage, app } from 'electron';
import path from 'path';
import { WindowManager } from './window-manager';

export class TrayManager {
  private tray: Tray | null = null;
  
  constructor(private windowManager: WindowManager) {}
  
  createTray(): void {
    // Try to load icon, fall back to empty if not exists
    let icon;
    try {
      const iconPath = path.join(__dirname, '../../assets/icon.png');
      icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
      if (icon.isEmpty()) {
        icon = nativeImage.createEmpty();
      }
    } catch {
      icon = nativeImage.createEmpty();
    }
    
    this.tray = new Tray(icon);
    this.tray.setToolTip('Live Deposit Monitor');
    this.updateContextMenu(false);
    
    this.tray.on('click', () => {
      this.windowManager.show();
    });
  }
  
  updateContextMenu(isMonitoring: boolean): void {
    if (!this.tray) return;
    
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Open Dashboard', click: () => this.windowManager.show() },
      { type: 'separator' },
      { label: 'Pause Monitoring', enabled: isMonitoring, click: () => {} },
      { label: 'Resume Monitoring', enabled: !isMonitoring, click: () => {} },
      { type: 'separator' },
      {
        label: 'Exit',
        click: () => {
          (global as any).isQuitting = true;
          app.quit();
        }
      }
    ]);
    
    this.tray.setContextMenu(contextMenu);
  }
  
  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }
}
