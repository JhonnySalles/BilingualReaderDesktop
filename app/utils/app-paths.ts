import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Returns the base root directory where executable (.exe) or project root is located.
 */
export function getAppBaseDir(): string {
  if (app && app.isPackaged) {
    return path.dirname(app.getPath('exe'));
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
