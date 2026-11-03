import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterOutlet } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { AqLogo } from '@/app/shared/ui/logo';
import { AqLangToggle } from '@/app/shared/ui/user-menu';

/** Phone: green band with the logo above the form. Laptop: brand panel beside the form. */
@Component({
  selector: 'auth-layout',
  imports: [RouterOutlet, MatIconModule, TranslocoDirective, AqLogo, AqLangToggle],
  template: `
    <ng-container *transloco="let t">
      <div class="flex min-h-dvh flex-col bg-white lg:flex-row">
        <section class="flex flex-col items-center gap-3 bg-primary-600 px-6 pt-10 pb-8 text-white lg:w-[44%] lg:items-start lg:justify-center lg:px-16">
          <aq-logo [size]="72" [inverse]="true" [wordmark]="false" class="lg:hidden" />
          <aq-logo [size]="88" [inverse]="true" class="hidden lg:block" />
          <p class="text-center text-[0.95rem] text-primary-100 lg:mt-6 lg:text-start lg:text-xl lg:font-bold lg:text-white">{{ t('auth.brandLine') }}</p>
          <ul class="mt-4 hidden flex-col gap-3 lg:flex">
            @for (point of $any(t('auth.brandPoints')); track $index) {
              <li class="flex items-center gap-3 text-lg text-primary-100">
                <span class="flex size-8 items-center justify-center rounded-full bg-white/15"><mat-icon svgIcon="check" class="icon-size-4 text-white" /></span>
                {{ point }}
              </li>
            }
          </ul>
        </section>

        <section class="flex flex-1 flex-col">
          <div class="flex justify-end p-3"><aq-lang-toggle /></div>
          <div class="flex flex-1 items-start justify-center px-5 pb-10 sm:items-center">
            <div class="w-full max-w-md">
              <router-outlet />
            </div>
          </div>
        </section>
      </div>
    </ng-container>
  `,
})
export default class AuthLayout {}
