import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

/** Until SMS recovery exists, passwords are reset by the school or center. */
@Component({
  selector: 'auth-forgot-password',
  imports: [RouterLink, MatIconModule, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <div class="mb-4 flex size-14 items-center justify-center rounded-full bg-secondary-100 text-secondary-600">
        <mat-icon svgIcon="key-round" class="icon-size-7" />
      </div>
      <h1 class="text-2xl font-extrabold sm:text-3xl">{{ t('auth.forgotTitle') }}</h1>
      <p class="mt-3 text-[1.05rem] leading-relaxed">{{ t('auth.forgotBody') }}</p>
      <p class="mt-2 text-muted">{{ t('auth.forgotSoon') }}</p>
      <a routerLink="/auth/sign-in" class="btn btn-secondary btn-block mt-8">{{ t('auth.backToSignIn') }}</a>
    </ng-container>
  `,
})
export default class AuthForgotPassword {}
