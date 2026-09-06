"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrayService = void 0;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class TrayService {
    static _instance;
    tray = null;
    getMainWindow = () => null;
    static get instance() {
        if (!TrayService._instance) {
            TrayService._instance = new TrayService();
        }
        return TrayService._instance;
    }
    init(getMainWindow) {
        this.getMainWindow = getMainWindow;
        if (this.tray) {
            return;
        }
        const iconPath = this.getTrayIconPath();
        const trayIcon = electron_1.nativeImage.createFromPath(iconPath);
        this.tray = new electron_1.Tray(trayIcon);
        this.tray.setToolTip('Bilingual Reader');
        const contextMenu = electron_1.Menu.buildFromTemplate([
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
                    electron_1.app.quit();
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
    showWindow() {
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
    hideWindow() {
        const win = this.getMainWindow();
        if (win && win.isVisible()) {
            win.hide();
        }
    }
    toggleWindow() {
        const win = this.getMainWindow();
        if (win) {
            if (win.isVisible() && !win.isMinimized() && win.isFocused()) {
                win.hide();
            }
            else {
                this.showWindow();
            }
        }
    }
    destroy() {
        if (this.tray) {
            this.tray.destroy();
            this.tray = null;
        }
    }
    getTrayIconPath() {
        const candidates = [
            path.join(__dirname, '../assets/icons/tray-icon.png'),
            path.join(__dirname, 'assets/icons/tray-icon.png'),
            path.join(electron_1.app.getAppPath(), 'app/assets/icons/tray-icon.png'),
            path.join(electron_1.app.getAppPath(), 'public/assets/icons/tray-icon.png'),
            path.join(electron_1.app.getAppPath(), 'app/assets/icons/icon.ico')
        ];
        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }
        return path.join(electron_1.app.getAppPath(), 'app/assets/icons/tray-icon.png');
    }
}
exports.TrayService = TrayService;
