import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

export type AppLang = 'ar' | 'en';

/**
 * Language and text direction. Arabic (RTL) is the default; English (LTR) is the second language.
 * The choice is remembered on the device.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private transloco = inject(TranslocoService);
  private document = inject(DOCUMENT);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly lang = signal<AppLang>('ar');
  readonly currentDir = signal<'ltr' | 'rtl'>('rtl');

  init(): void {
    const saved = this.isBrowser ? (localStorage.getItem('app_lang') as AppLang | null) : null;
    this.transloco.langChanges$.subscribe(lang => this.apply(lang as AppLang));
    this.transloco.setActiveLang(saved === 'en' ? 'en' : 'ar');
  }

  toggle(): void {
    this.transloco.setActiveLang(this.lang() === 'ar' ? 'en' : 'ar');
  }

  private apply(lang: AppLang): void {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    this.lang.set(lang);
    this.currentDir.set(dir);
    const html = this.document.documentElement;
    html.setAttribute('lang', lang);
    html.setAttribute('dir', dir);
    if (this.isBrowser) localStorage.setItem('app_lang', lang);
  }
}
