import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export const CONVERT_TIMEOUT_MS = 180_000;

export function findExecutable(command: string, extraPaths: string[] = []): string | null {
  for (const p of extraPaths) {
    if (p && fs.existsSync(p)) return p;
  }

  const pathEnv = process.env['PATH'] || '';
  const parts = pathEnv.split(path.delimiter);
  const names = process.platform === 'win32' ? [`${command}.exe`, command] : [command];

  for (const dir of parts) {
    for (const name of names) {
      const full = path.join(dir, name);
      if (fs.existsSync(full)) return full;
    }
  }
  return null;
}

export function spawnCommand(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true });
    let stderr = '';
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      reject(new Error(`Timeout após ${CONVERT_TIMEOUT_MS / 1000}s`));
    }, CONVERT_TIMEOUT_MS);

    child.stderr?.on('data', (d) => {
      stderr += d.toString();
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr.trim() || `exit ${code}`));
      }
    });
  });
}

export function calibreCandidatePaths(): string[] {
  return [
    path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Calibre2', 'ebook-convert.exe'),
    path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Calibre', 'ebook-convert.exe'),
    path.join(
      process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
      'Calibre2',
      'ebook-convert.exe'
    ),
    path.join(process.env['LOCALAPPDATA'] || '', 'Programs', 'Calibre', 'ebook-convert.exe')
  ].filter(Boolean);
}
