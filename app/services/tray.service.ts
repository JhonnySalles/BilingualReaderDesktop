import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export class TrayService {
  private static _instance: TrayService;
  private tray: Tray | null = null;
  private getMainWindow: () => BrowserWindow | null = () => null;

  public static get instance(): TrayService {
    if (!TrayService._instance) {
      TrayService._instance = new TrayService();
    }
    return TrayService._instance;
  }

  public init(getMainWindow: () => BrowserWindow | null): void {
    this.getMainWindow = getMainWindow;

    if (this.tray) {
      return;
    }

    const iconPath = this.getTrayIconPath();
    const trayIcon = nativeImage.createFromPath(iconPath);

    this.tray = new Tray(trayIcon);
    this.tray.setToolTip('Bilingual Reader');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Abrir Bilingual Reader',
        click: () => this.showWindow()
      },
      {
        label: 'Minimizar para a Bandeja',
        click: () => this.hideWindow()
      },
      { type: 'separator' },
      {
        label: 'Sair',
        click: () => {
          this.destroy();
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);

    this.tray.on('click', () => {
      this.toggleWindow();
    });

    this.tray.on('double-click', () => {
      this.showWindow();
    });
  }

  public showWindow(): void {
    const win = this.getMainWindow();
    if (win) {
      if (win.isMinimized()) {
        win.restore();
      }
      if (!win.isVisible()) {
        win.show();
      }
      win.focus();
    }
  }

  public hideWindow(): void {
    const win = this.getMainWindow();
    if (win && win.isVisible()) {
      win.hide();
    }
  }

  public toggleWindow(): void {
    const win = this.getMainWindow();
    if (win) {
      if (win.isVisible() && !win.isMinimized() && win.isFocused()) {
        win.hide();
      } else {
        this.showWindow();
      }
    }
  }

  public destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  private getTrayIconPath(): string {
    const candidates = [
      path.join(__dirname, '../assets/icons/tray-icon.png'),
      path.join(__dirname, 'assets/icons/tray-icon.png'),
      path.join(app.getAppPath(), 'app/assets/icons/tray-icon.png'),
      path.join(app.getAppPath(), 'public/assets/icons/tray-icon.png'),
      path.join(app.getAppPath(), 'app/assets/icons/icon.ico')
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return path.join(app.getAppPath(), 'app/assets/icons/tray-icon.png');
  }
}
