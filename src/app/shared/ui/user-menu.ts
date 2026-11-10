import { Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { AuthService } from '@/app/core/auth/auth.service';
import { I18nService } from '@/app/core/transloco/i18n.service';

/** Avatar button with the user's name, language switch and sign-out. */
@Component({
  selector: 'aq-user-menu',
  imports: [MatIconModule, MatMenuModule, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <button type="button" class="flex min-h-11 cursor-pointer items-center gap-2 rounded-ui px-1.5 hover:bg-neutral-100" [matMenuTriggerFor]="menu" [attr.aria-label]="t('nav.account')">
        <span class="flex size-9 items-center justify-center rounded-full bg-secondary-100 text-base font-extrabold text-secondary-600">{{ initial() }}</span>
        <span class="hidden max-w-36 truncate text-[0.95rem] font-bold md:inline">{{ displayName() }}</span>
      </button>
      <mat-menu #menu="matMenu" xPosition="before">
        <div class="px-4 py-2">
          <div class="font-bold">{{ displayName() }}</div>
          <div class="text-sm text-muted" dir="ltr">{{ auth.user()?.userName }}</div>
        </div>
        <button mat-menu-item (click)="i18n.toggle()">
          <mat-icon svgIcon="languages" />{{ t('action.switchLanguage') }}
        </button>
        <button mat-menu-item (click)="signOut()">
          <mat-icon svgIcon="log-out" class="flip-rtl" />{{ t('action.signOut') }}
        </button>
      </mat-menu>
    </ng-container>
  `,
})
export class AqUserMenu {
  protected auth = inject(AuthService);
  protected i18n = inject(I18nService);
  private router = inject(Router);

  protected displayName = computed(() => this.auth.user()?.name || this.auth.user()?.userName || '');
  protected initial = computed(() => this.displayName().trim().charAt(0).toUpperCase());

  protected signOut(): void {
    this.auth.signOut().subscribe({ complete: () => this.router.navigateByUrl('/auth/sign-in') });
  }
}

/** Compact language switch for headers (shows the other language's name). */
@Component({
  selector: 'aq-lang-toggle',
  imports: [TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <button type="button" class="btn btn-ghost btn-sm" (click)="i18n.toggle()" [attr.lang]="i18n.lang() === 'ar' ? 'en' : 'ar'">
        {{ t('action.switchLanguage') }}
      </button>
    </ng-container>
  `,
})
export class AqLangToggle {
  protected i18n = inject(I18nService);
}
