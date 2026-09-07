import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ElectronService } from './electron.service';

/**
 * Renderer facade mirroring Android Telemetry.kt — routes through main-process Sentry.
 */
@Injectable({ providedIn: 'root' })
export class TelemetryService {
  private electron = inject(ElectronService);
  private enabledCache: boolean | null = null;

  get isEnabled(): boolean {
    return !!this.enabledCache;
  }

  /** Resolve enabled flag once (from main Secrets / Sentry init). */
  async refreshEnabled(): Promise<boolean> {
    this.enabledCache = await this.electron.telemetryIsEnabled();
    return this.enabledCache;
  }

  recordException(error: unknown, message?: string): void {
    if (this.enabledCache === false) {
      const detail = message || (error instanceof Error ? error.message : String(error));
      console.warn(`[Telemetry] disabled. Exception ignored: ${detail}`);
      return;
    }
    void this.electron.telemetryRecord(error, message).catch(() => {
      /* ignore IPC failures */
    });
  }

  setCustomKey(key: string, value: string): void {
    if (this.enabledCache === false) return;
    void this.electron.telemetrySetKey(key, value).catch(() => {
      /* ignore */
    });
  }
}

@Injectable()
export class TelemetryErrorHandler implements ErrorHandler {
  private telemetry = inject(TelemetryService);

  handleError(error: unknown): void {
    this.telemetry.recordException(error, 'Angular ErrorHandler');
    // Keep a local console breadcrumb for developers when telemetry is off or delayed.
    console.error(error);
  }
}
