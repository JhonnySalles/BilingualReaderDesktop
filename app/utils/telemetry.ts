import * as Sentry from '@sentry/electron/main';
import { Secrets } from './secrets';

/**
 * Centralized error reporting — mirrors Android Telemetry.kt (Sentry only on desktop).
 */
export class Telemetry {
  private static initialized = false;
  private static enabled = false;

  static get isEnabled(): boolean {
    return this.enabled;
  }

  /** Call once as early as possible in the Electron main process. */
  static init(): void {
    if (this.initialized) return;
    this.initialized = true;

    const secrets = Secrets.instance;
    this.enabled = secrets.isTelemetryEnabled();

    if (!this.enabled) {
      return;
    }

    const dsn = secrets.getSentryDsn().trim();
    const environment = secrets.getSentryEnvironment();
    const tracesSampleRate = secrets.getSentryTracesSampleRate();

    Sentry.init({
      dsn,
      environment,
      tracesSampleRate,
      // Avoid Sentry debug console noise unless explicitly testing.
      debug: false,
      beforeSend(event) {
        if (!Telemetry.enabled) return null;
        const exception = event.exception?.values?.[0];
        const value = exception?.value || '';
        // Mirror Android: drop noisy gateway timeouts from third-party HTTP.
        if (
          exception?.type === 'SentryHttpClientException' &&
          typeof value === 'string' &&
          value.includes('504')
        ) {
          return null;
        }
        return event;
      }
    });
  }

  static recordException(error: unknown, message?: string): void {
    if (!this.enabled) {
      const detail = message || (error instanceof Error ? error.message : String(error));
      console.warn(`[Telemetry] disabled. Exception ignored: ${detail}`);
      return;
    }

    try {
      const err = this.toError(error);
      Sentry.withScope(scope => {
        if (message) {
          scope.setExtra('message', message);
        }
        Sentry.captureException(err);
      });
    } catch (ex: any) {
      console.error('[Telemetry] Failed to record exception:', ex?.message || ex);
    }
  }

  static setCustomKey(key: string, value: string): void {
    if (!this.enabled) return;
    try {
      Sentry.setTag(key, value);
    } catch (ex: any) {
      console.error('[Telemetry] Failed to set custom key:', ex?.message || ex);
    }
  }

  /** Reconstruct Error from IPC payload. */
  static fromSerialized(payload: {
    name?: string;
    message?: string;
    stack?: string;
  }): Error {
    const err = new Error(payload.message || 'Unknown error');
    if (payload.name) err.name = payload.name;
    if (payload.stack) err.stack = payload.stack;
    return err;
  }

  static toSerialized(error: unknown): { name: string; message: string; stack?: string } {
    const err = this.toError(error);
    return { name: err.name, message: err.message, stack: err.stack };
  }

  private static toError(error: unknown): Error {
    if (error instanceof Error) return error;
    if (typeof error === 'string') return new Error(error);
    try {
      return new Error(JSON.stringify(error));
    } catch {
      return new Error(String(error));
    }
  }
}
