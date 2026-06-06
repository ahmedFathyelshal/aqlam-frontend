import { Injectable, inject, PLATFORM_ID, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Directionality } from '@angular/cdk/bidi';

@Injectable({
  providedIn: 'root'
})
export class I18nService {
  private transloco = inject(TranslocoService);
  private document = inject(DOCUMENT);

  private platformId = inject(PLATFORM_ID);

  // Expose current direction as a Signal so we can bind it to Material components
  public currentDir = signal<'ltr' | 'rtl'>('ltr');

  // Initialize the language and direction
  init(): void {
    if (isPlatformBrowser(this.platformId)) {
      // 1. Load saved language from localStorage if available
      const savedLang = localStorage.getItem('app_lang');
      if (savedLang) {
        this.transloco.setActiveLang(savedLang);
      }
    }

    // 2. Subscribe to language changes to update HTML and save preference
    this.transloco.langChanges$.subscribe((lang) => {
      this.updateDirectionality(lang);
      
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem('app_lang', lang);
      }
    });
    
    // Set initial
    this.updateDirectionality(this.transloco.getActiveLang());
  }

  private updateDirectionality(lang: string): void {
    const htmlElement = this.document.documentElement;
    
    // Set lang attribute
    htmlElement.setAttribute('lang', lang);

    // Set dir attribute based on language
    if (lang === 'ar') {
      htmlElement.setAttribute('dir', 'rtl');
      this.currentDir.set('rtl');
    } else {
      htmlElement.setAttribute('dir', 'ltr');
      this.currentDir.set('ltr');
    }
    
    // If you ever need to forcefully dispatch an event for third party libraries
    // window.dispatchEvent(new Event('resize')); 
  }
}
