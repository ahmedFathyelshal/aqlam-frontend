import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { AuthService } from '@/app/core/auth/auth.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';
import { AqLogo } from '@/app/shared/ui/logo';

/** Replaces a temporary password (accounts imported by a school must do this before anything else). */
@Component({
  selector: 'auth-change-password',
  imports: [TranslocoDirective, AqLogo],
  template: `
    <ng-container *transloco="let t">
      <div class="flex min-h-dvh items-start justify-center bg-page px-4 py-10 sm:items-center">
        <div class="card card-body w-full max-w-md">
          <aq-logo [size]="44" />
          <h1 class="mt-6 text-2xl font-extrabold">{{ t('auth.changeTitle') }}</h1>
          <p class="mt-1 text-muted">{{ t('auth.changeIntro') }}</p>
          <form class="mt-6 flex flex-col gap-4" (submit)="submit($event)" novalidate>
            <label class="field">
              <span class="field-label">{{ t('auth.currentPassword') }}</span>
              <input class="input" type="password" autocomplete="current-password" [value]="current()" (input)="current.set($any($event.target).value)" />
            </label>
            <label class="field">
              <span class="field-label">{{ t('auth.newPassword') }}</span>
              <input class="input" type="password" autocomplete="new-password" [value]="next()" (input)="next.set($any($event.target).value)" />
              <span [class]="touched() && next().length < 8 ? 'field-error' : 'field-hint'">{{ t('auth.passwordRule') }}</span>
            </label>
            <label class="field">
              <span class="field-label">{{ t('auth.confirmPassword') }}</span>
              <input class="input" type="password" autocomplete="new-password" [value]="confirm()" (input)="confirm.set($any($event.target).value)" />
              @if (touched() && confirm() !== next()) { <span class="field-error">{{ t('auth.mismatch') }}</span> }
            </label>
            @if (errors().length) { <div class="alert alert-danger" role="alert">{{ errors().join(' ') }}</div> }
            <button type="submit" class="btn btn-primary btn-block min-h-12" [disabled]="busy()">{{ t('auth.changeButton') }}</button>
          </form>
        </div>
      </div>
    </ng-container>
  `,
})
export default class ChangePassword {
  private auth = inject(AuthService);
  private router = inject(Router);

  protected current = signal('');
  protected next = signal('');
  protected confirm = signal('');
  protected touched = signal(false);
  protected busy = signal(false);
  protected errors = signal<string[]>([]);

  protected submit(event: Event): void {
    event.preventDefault();
    this.touched.set(true);
    this.errors.set([]);
    if (!this.current() || this.next().length < 8 || this.confirm() !== this.next()) return;

    this.busy.set(true);
    this.auth.changePassword(this.current(), this.next()).subscribe({
      next: () => this.router.navigateByUrl(this.auth.homeRoute()),
      error: (err: unknown) => {
        this.busy.set(false);
        this.errors.set(errorMessages(err, 'Error'));
      },
    });
  }
}
