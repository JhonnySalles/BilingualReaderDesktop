import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { TelemetryService } from './app/core/services/telemetry.service';

async function bootstrapTelemetryRenderer(): Promise<void> {
  const api = (window as any).electronAPI;
  if (!api?.telemetryIsEnabled) return;

  try {
    const enabled = !!(await api.telemetryIsEnabled());
    if (!enabled) return;
    // Events from the renderer are forwarded through the main process SDK.
    const sentry = await import('@sentry/electron/renderer');
    sentry.init();
  } catch (e) {
    console.warn('[Telemetry] renderer init skipped:', e);
  }
}

bootstrapTelemetryRenderer()
  .catch(() => undefined)
  .finally(() => {
    bootstrapApplication(AppComponent, appConfig)
      .then(appRef => {
        try {
          const telemetry = appRef.injector.get(TelemetryService);
          void telemetry.refreshEnabled();
        } catch {
          /* ignore */
        }
      })
      .catch(err => {
        console.error(err);
        const api = (window as any).electronAPI;
        if (api?.telemetryRecord) {
          const error = err instanceof Error ? err : new Error(String(err));
          void api.telemetryRecord({
            error: { name: error.name, message: error.message, stack: error.stack },
            message: 'bootstrapApplication failed'
          });
        }
      });
  });
