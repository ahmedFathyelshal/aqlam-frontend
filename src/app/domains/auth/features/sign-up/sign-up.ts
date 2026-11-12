import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { AuthService } from '@/app/core/auth/auth.service';
import { UserType } from '@/app/core/models/user-type.enum';
import { errorMessages } from '@/app/core/utils/api-error.utils';

/** Self sign-up for students, teachers and parents (email optional: many students have none). */
@Component({
  selector: 'auth-sign-up',
  imports: [RouterLink, MatIconModule, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <h1 class="text-2xl font-extrabold sm:text-3xl">{{ t('auth.signUp') }}</h1>
      <p class="mt-1 text-muted">{{ t('auth.haveAccount') }} <a routerLink="/auth/sign-in" queryParamsHandling="preserve" class="font-bold">{{ t('auth.signIn') }}</a></p>

      <form class="mt-6 flex flex-col gap-4" (submit)="submit($event)" novalidate>
        <fieldset class="flex flex-col gap-2">
          <legend class="field-label mb-2">{{ t('auth.iAm') }}</legend>
          @for (option of types; track option.value) {
            <label class="flex min-h-14 cursor-pointer items-center gap-3 rounded-ui border px-4 py-2.5"
                   [class]="userType() === option.value ? 'border-primary-600 bg-primary-50' : 'border-line bg-white'">
              <input type="radio" name="userType" class="size-5 accent-primary-600" [checked]="userType() === option.value" (change)="userType.set(option.value)" />
              <mat-icon [svgIcon]="option.icon" class="icon-size-6 text-primary-600" />
              <span class="flex flex-col">
                <span class="font-bold">{{ t('auth.type.' + option.key) }}</span>
                <span class="text-sm text-muted">{{ t('auth.type.' + option.key + 'Hint') }}</span>
              </span>
            </label>
          }
        </fieldset>

        @if (userType() === student) {
          <label class="field">
            <span class="field-label">{{ t('age.birthYear') }}</span>
            <input class="input w-40" type="number" inputmode="numeric" dir="ltr" min="1900" [max]="thisYear" [placeholder]="thisYear - 15"
                   [value]="birthYear() ?? ''" (input)="birthYear.set($any($event.target).value ? +$any($event.target).value : null)" />
            <span class="field-hint">{{ t('age.birthYearHint') }}</span>
            @if (touched() && !birthYearValid()) { <span class="field-error">{{ t('age.birthYearRequired') }}</span> }
          </label>
          @if (underThirteen()) {
            <div class="alert alert-info flex-col items-start gap-1" role="status">
              <p class="font-bold">{{ t('age.under13Title') }}</p>
              <p class="text-sm">{{ t('age.under13Body') }}</p>
              <button type="button" class="btn btn-outline btn-sm mt-2" (click)="userType.set(parent)">{{ t('age.under13Action') }}</button>
            </div>
          }
        }

        <label class="field">
          <span class="field-label">{{ t('auth.userName') }}</span>
          <input class="input" dir="ltr" autocomplete="username" autocapitalize="none" spellcheck="false" [value]="userName()" (input)="userName.set($any($event.target).value)" />
          @if (touched() && !userName().trim()) { <span class="field-error">{{ t('auth.required') }}</span> }
        </label>

        <label class="field">
          <span class="field-label">{{ t('auth.email') }}</span>
          <input class="input" type="email" dir="ltr" autocomplete="email" [value]="email()" (input)="email.set($any($event.target).value)" />
          @if (touched() && emailInvalid()) { <span class="field-error">{{ t('auth.emailInvalid') }}</span> }
        </label>

        <div class="grid gap-4 sm:grid-cols-2">
          <label class="field">
            <span class="field-label">{{ t('auth.password') }}</span>
            <input class="input" type="password" autocomplete="new-password" [value]="password()" (input)="password.set($any($event.target).value)" />
            <span [class]="touched() && password().length < 8 ? 'field-error' : 'field-hint'">{{ t('auth.passwordRule') }}</span>
          </label>
          <label class="field">
            <span class="field-label">{{ t('auth.confirmPassword') }}</span>
            <input class="input" type="password" autocomplete="new-password" [value]="confirm()" (input)="confirm.set($any($event.target).value)" />
            @if (touched() && confirm() !== password()) { <span class="field-error">{{ t('auth.mismatch') }}</span> }
          </label>
        </div>

        @if (errors().length) {
          <div class="alert alert-danger" role="alert">{{ errors().join(' ') }}</div>
        }

        <button type="submit" class="btn btn-primary btn-block min-h-12 text-lg" [disabled]="busy()">{{ t('auth.signUpButton') }}</button>
      </form>
    </ng-container>
  `,
})
export default class AuthSignUp {
  private router = inject(Router);
  private auth = inject(AuthService);

  protected readonly types = [
    { value: UserType.Student, key: 'student', icon: 'graduation-cap' },
    { value: UserType.Teacher, key: 'teacher', icon: 'school' },
    { value: UserType.Parent, key: 'parent', icon: 'users-round' },
  ];

  protected userType = signal<UserType>(UserType.Student);
  protected readonly student = UserType.Student;
  protected readonly parent = UserType.Parent;
  protected readonly thisYear = new Date().getFullYear();
  /** Students only; under 13 a parent creates the account (agreed 2026-11-12). */
  protected birthYear = signal<number | null>(null);
  protected birthYearValid = computed(() => {
    const y = this.birthYear();
    return y !== null && y >= 1900 && y <= this.thisYear;
  });
  protected underThirteen = computed(() => this.birthYearValid() && this.thisYear - this.birthYear()! < 13);
  protected userName = signal('');
  protected email = signal('');
  protected password = signal('');
  protected confirm = signal('');
  protected touched = signal(false);
  protected busy = signal(false);
  protected errors = signal<string[]>([]);

  protected emailInvalid = computed(() => !!this.email().trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.email().trim()));

  protected submit(event: Event): void {
    event.preventDefault();
    this.touched.set(true);
    this.errors.set([]);
    if (!this.userName().trim() || this.emailInvalid() || this.password().length < 8 || this.confirm() !== this.password()) return;
    const isStudent = this.userType() === UserType.Student;
    if (isStudent && (!this.birthYearValid() || this.underThirteen())) return;

    this.busy.set(true);
    this.auth
      .signUp({
        userName: this.userName().trim(),
        email: this.email().trim() || null,
        password: this.password(),
        confirmPassword: this.confirm(),
        userType: this.userType(),
        birthYear: isStudent ? this.birthYear() : null,
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          // Keep the way back (e.g. to the course the visitor wanted to join).
          const redirectURL = this.router.parseUrl(this.router.url).queryParams['redirectURL'] as string | undefined;
          const safe = redirectURL?.startsWith('/') && !redirectURL.startsWith('//') ? redirectURL : undefined;
          this.router.navigate(['/auth/sign-in'], { queryParams: { created: 1, redirectURL: safe } });
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.errors.set(errorMessages(err, 'Error'));
        },
      });
  }
}
