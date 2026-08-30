import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export class SettingsService {
  private static _instance: SettingsService;
  private filePath: string;
  private settingsData: Record<string, any> = {};

  public static get instance(): SettingsService {
    if (!this._instance) {
      this._instance = new SettingsService();
    }
    return this._instance;
  }

  constructor() {
    const userDataPath = app ? app.getPath('userData') : process.cwd();
    this.filePath = path.join(userDataPath, 'settings.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.settingsData = JSON.parse(raw);
      } else {
        this.settingsData = {};
      }
    } catch (e) {
      console.error('Error loading settings.json:', e);
      this.settingsData = {};
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.settingsData, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving settings.json:', e);
    }
  }

  public get<T = any>(key: string, defaultValue?: T): T {
    if (key in this.settingsData) {
      return this.settingsData[key];
    }
    return defaultValue as T;
  }

  public set(key: string, value: any): void {
    this.settingsData[key] = value;
    this.save();
  }

  public remove(key: string): void {
    delete this.settingsData[key];
    this.save();
  }

  public clear(): void {
    this.settingsData = {};
    this.save();
  }
}
