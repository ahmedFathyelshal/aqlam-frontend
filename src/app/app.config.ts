import { TranslocoHttpLoader } from '@/app/core/transloco/transloco-http-loader';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  PLATFORM_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import {
  provideClientHydration,
  withHttpTransferCacheOptions,
  withIncrementalHydration,
} from '@angular/platform-browser';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';
import { provideIcons } from '@/app/core/icons/provider';
import { provideTransloco } from '@jsverse/transloco';
import { authInterceptor } from '@/app/core/auth/auth.interceptor';
import { errorInterceptor } from '@/app/core/interceptors/error.interceptor';
import { serverApiInterceptor } from '@/app/core/interceptors/server-api.interceptor';
import { routes } from './app.routes';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '@/app/core/auth/auth.service';
import { catchError, firstValueFrom, of } from 'rxjs';

/** Restores the session from HttpOnly cookies before the first navigation (browser only). */
function initializeAuth(): Promise<unknown> {
  const authService = inject(AuthService);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return Promise.resolve();
  }

  // Ignore errors: a visitor without a valid cookie is simply anonymous.
  return firstValueFrom(authService.getMe().pipe(catchError(() => of(null))));
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(initializeAuth),
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch(), withInterceptors([serverApiInterceptor, authInterceptor, errorInterceptor])),
    // Responses fetched while rendering on the server are reused in the browser, except a course page's own data:
    // its "viewer" part depends on who is signed in, which the server does not know.
    provideClientHydration(
      withIncrementalHydration(),
      withHttpTransferCacheOptions({ filter: req => !/\/api\/marketplace\/courses\/[^?]/.test(req.url) && !req.url.includes('/api/Auth/') })
    ),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' })
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

    // Third-party
    provideTransloco({
      config: {
        availableLangs: [
          { id: 'ar', label: 'العربية' },
          { id: 'en', label: 'English' },
        ],
        defaultLang: 'ar',
        fallbackLang: 'ar',
        missingHandler: { useFallbackTranslation: true },
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
  ],
};
