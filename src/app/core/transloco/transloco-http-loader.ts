import { Injectable } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { of } from 'rxjs';
import { translations } from './i18n';

/**
 * Translations are bundled (not fetched) so server-rendered pages already contain Arabic text
 * and there is no flash of untranslated keys. Each feature keeps its texts in ./i18n/<feature>.ts.
 */
@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  getTranslation(lang: string) {
    return of((translations[lang as keyof typeof translations] ?? translations.ar) as Translation);
  }
}
