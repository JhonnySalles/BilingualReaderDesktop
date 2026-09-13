import * as path from 'path';
import * as fs from 'fs';

let customBaseDir: string | null = null;
let customCoversDir: string | null = null;

export function setAppBaseDir(dir: string): void {
  customBaseDir = dir;
}

export function setAppCoversDir(dir: string): void {
  customCoversDir = dir;
}

function getElectronApp(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require('electron');
    return electron?.app || (electron?.remote?.app) || null;
  } catch {
    return null;
  }
}

export function isAppPackaged(): boolean {
  const electronApp = getElectronApp();
  if (electronApp) {
    return Boolean(electronApp.isPackaged);
  }
  // Fallback for worker_threads or environments where electron is not directly resolvable:
  if (process.resourcesPath || (typeof __dirname === 'string' && __dirname.includes('app.asar'))) {
    return true;
  }
  if (process.execPath) {
    const execName = path.basename(process.execPath).toLowerCase();
    return execName !== 'electron.exe' && execName !== 'electron' && !execName.startsWith('node');
  }
  return false;
}

/**
 * Returns the base root directory where executable (.exe) or project root is located.
 */
export function getAppBaseDir(): string {
  if (customBaseDir) {
    return customBaseDir;
  }
  const electronApp = getElectronApp();
  if (electronApp && electronApp.isPackaged) {
    return path.dirname(electronApp.getPath('exe'));
  }
  if (isAppPackaged() && process.execPath) {
    return path.dirname(process.execPath);
  }
  return process.cwd();
}

/**
 * Returns the path to persistent application data (data/).
 */
export function getAppDataDir(): string {
  const dir = path.join(getAppBaseDir(), 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Returns the path to cache files (cache/).
 */
export function getAppCacheDir(): string {
  const dir = path.join(getAppBaseDir(), 'cache');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Returns the path to native libraries and dictionaries (data/libs).
 */
export function getAppLibsDir(): string {
  const dir = path.join(getAppDataDir(), 'libs');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Returns the path to cover images (data/covers).
 */
export function getAppCoversDir(): string {
  if (customCoversDir) {
    if (!fs.existsSync(customCoversDir)) {
      fs.mkdirSync(customCoversDir, { recursive: true });
    }
    return customCoversDir;
  }
  const dir = path.join(getAppDataDir(), 'covers');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Ensures all root subdirectories exist and migrates legacy files/folders from base directory into data/ or cache/.
 */
export function ensureAppDirs(): void {
  const base = getAppBaseDir();
  const data = getAppDataDir();
  const cache = getAppCacheDir();
  const covers = getAppCoversDir();
  const libs = getAppLibsDir();

  // Create subdirectories
  const dirsToEnsure = [
    path.join(covers, 'manga'),
    path.join(covers, 'book'),
    path.join(libs, 'sudachi'),
    path.join(cache, 'audio'),
    path.join(cache, 'convert'),
    path.join(cache, 'manga-pages'),
    path.join(cache, 'sharemark'),
    path.join(cache, 'temp'),
    path.join(data, 'userData')
  ];

  for (const d of dirsToEnsure) {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  }

  // File & folder migration map: legacy relative path -> new relative path
  const migrations: Array<{ src: string; dest: string }> = [
    { src: 'BilingualReaderDesktop.db', dest: path.join('data', 'BilingualReaderDesktop.db') },
    { src: 'BilingualReaderDesktop.db-wal', dest: path.join('data', 'BilingualReaderDesktop.db-wal') },
    { src: 'BilingualReaderDesktop.db-shm', dest: path.join('data', 'BilingualReaderDesktop.db-shm') },
    { src: 'settings.json', dest: path.join('data', 'settings.json') },
    { src: 'google-oauth.json', dest: path.join('data', 'google-oauth.json') },
    { src: 'google-oauth-credentials.json', dest: path.join('data', 'google-oauth-credentials.json') },
    { src: 'manga_cover', dest: path.join('data', 'covers', 'manga') },
    { src: 'book_cover', dest: path.join('data', 'covers', 'book') },
    { src: 'sudachi', dest: path.join('data', 'libs', 'sudachi') },
    { src: 'sharemark-cache', dest: path.join('cache', 'sharemark') }
  ];

  for (const item of migrations) {
    const srcPath = path.join(base, item.src);
    const destPath = path.join(base, item.dest);

    if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
      try {
        const destParent = path.dirname(destPath);
        if (!fs.existsSync(destParent)) {
          fs.mkdirSync(destParent, { recursive: true });
        }

        const stat = fs.statSync(srcPath);
        if (stat.isDirectory()) {
          if (!fs.existsSync(destPath)) {
            fs.mkdirSync(destPath, { recursive: true });
          }
          const files = fs.readdirSync(srcPath);
          for (const f of files) {
            const s = path.join(srcPath, f);
            const d = path.join(destPath, f);
            if (!fs.existsSync(d)) {
              fs.renameSync(s, d);
            }
          }
          try {
            fs.rmdirSync(srcPath);
          } catch {
            /* ignore if directory not empty */
          }
        } else {
          fs.renameSync(srcPath, destPath);
        }
        console.log(`[AppPaths] Migrated legacy path: ${item.src} -> ${item.dest}`);
      } catch (e) {
        console.warn(`[AppPaths] Failed to migrate ${item.src} to ${item.dest}:`, e);
      }
    }
  }
}
