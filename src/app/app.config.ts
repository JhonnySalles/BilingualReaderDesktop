import { ApplicationConfig, ErrorHandler, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { provideTranslateService } from '@ngx-translate/core';
import { routes } from './app.routes';
import { TelemetryErrorHandler } from './core/services/telemetry.service';
import { StaticTranslateLoader } from './core/i18n/static-translate-loader';

registerLocaleData(localePt);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withViewTransitions({
        skipInitialTransition: true
      })
    ),
    provideTranslateService({
      fallbackLang: 'en',
      loader: StaticTranslateLoader
    }),
    { provide: ErrorHandler, useClass: TelemetryErrorHandler }
  ]
};
