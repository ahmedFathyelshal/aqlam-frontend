import { TranslocoHttpLoader } from '@/app/core/transloco/transloco-http-loader';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import {
  provideClientHydration,
  withIncrementalHydration,
} from '@angular/platform-browser';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';
import { provideIcons } from '@/app/core/icons/provider';
import { provideTheming } from '@/app/core/theming';
import { provideTransloco } from '@jsverse/transloco';
import { authInterceptor } from '@/app/core/auth/auth.interceptor';
import { errorInterceptor } from '@/app/core/interceptors/error.interceptor';
import { routes } from './app.routes';
import { APP_INITIALIZER, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '@/app/core/auth/auth.service';
import { catchError, of, take } from 'rxjs';

function initializeAuth() {
  const authService = inject(AuthService);
  const platformId = inject(PLATFORM_ID);
  return () => {
    if (isPlatformBrowser(platformId)) {
      return authService.getMe().pipe(
        take(1),
        catchError(() => of(null)) // Ignore error if no valid cookie exists yet
      );
    }
    return of(null);
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuth,
      multi: true,
    },
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor])),
    provideClientHydration(withIncrementalHydration()),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })
    ),

    // Material
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: {
        subscriptSizing: 'dynamic',
      },
    },
    provideNativeDateAdapter(),

    // Core
    provideIcons(),
    provideTheming({
      scheme: 'system',
      primary: '#1565C0',
      error: '#dc2626',
    }),

    // Third-party
    provideTransloco({
      config: {
        availableLangs: [
          {
            id: 'en',
            label: 'English',
          },
          {
            id: 'ar',
            label: 'العربية',
          },
        ],
        defaultLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
  ],
};
