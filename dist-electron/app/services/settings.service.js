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
exports.SettingsService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const electron_1 = require("electron");
class SettingsService {
    static _instance;
    filePath;
    settingsData = {};
    static get instance() {
        if (!this._instance) {
            this._instance = new SettingsService();
        }
        return this._instance;
    }
    constructor() {
        const userDataPath = electron_1.app ? electron_1.app.getPath('userData') : process.cwd();
        this.filePath = path.join(userDataPath, 'settings.json');
        this.load();
    }
    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                const raw = fs.readFileSync(this.filePath, 'utf-8');
                this.settingsData = JSON.parse(raw);
            }
            else {
                this.settingsData = {};
            }
        }
        catch (e) {
            console.error('Error loading settings.json:', e);
            this.settingsData = {};
        }
    }
    save() {
        try {
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.filePath, JSON.stringify(this.settingsData, null, 2), 'utf-8');
        }
        catch (e) {
            console.error('Error saving settings.json:', e);
        }
    }
    get(key, defaultValue) {
        if (key in this.settingsData) {
            return this.settingsData[key];
        }
        return defaultValue;
    }
    set(key, value) {
        this.settingsData[key] = value;
        this.save();
    }
    remove(key) {
        delete this.settingsData[key];
        this.save();
    }
    clear() {
        this.settingsData = {};
        this.save();
    }
}
exports.SettingsService = SettingsService;
