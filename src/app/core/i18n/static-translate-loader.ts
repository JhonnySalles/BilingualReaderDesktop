import { TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import enTranslations from '../../../assets/i18n/en.json';
import ptTranslations from '../../../assets/i18n/pt.json';

export class StaticTranslateLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<Record<string, any>> {
    if (lang === 'pt') {
      return of(ptTranslations);
    }
    return of(enTranslations);
  }
}

