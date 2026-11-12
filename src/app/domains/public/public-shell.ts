import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { AuthService } from '@/app/core/auth/auth.service';
import { LookupNames } from '@/app/core/marketplace/lookup-names.service';
import { I18nService } from '@/app/core/transloco/i18n.service';
import { AqLogo } from '@/app/shared/ui/logo';
import { environment } from '@/environments/environment';

/**
 * Frame of the public marketplace pages (search, teacher, course, test prep): the same logo-green band as the public
 * home page, open to visitors. Signed-in users get a link back to their own home instead of "sign in".
 */
@Component({
  selector: 'aq-public-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, TranslocoDirective, AqLogo],
  template: `
    <ng-container *transloco="let t">
      <div class="flex min-h-dvh flex-col bg-page text-ink">
        <header class="bg-primary-600 text-white">
          <div class="mx-auto flex max-w-[1240px] items-center gap-4 px-4 py-3 lg:px-10">
            <a routerLink="/" class="no-underline"><aq-logo [size]="38" [inverse]="true" /></a>
            <nav class="flex grow" [attr.aria-label]="t('nav.menu')">
              <a routerLink="/search" routerLinkActive="!text-white underline underline-offset-8" class="inline-flex min-h-11 items-center gap-1.5 px-2 font-medium text-[#E3ECE6] no-underline hover:text-white">
                <mat-icon svgIcon="search" class="icon-size-4.5" /><span class="max-sm:sr-only">{{ t('market.nav.search') }}</span>
              </a>
              @if (auth.user()?.roles?.includes('SuperAdmin')) {
                <a routerLink="/admin/marketplace" routerLinkActive="!text-white underline underline-offset-8" class="inline-flex min-h-11 items-center gap-1.5 px-2 font-medium text-[#E3ECE6] no-underline hover:text-white">
                  <mat-icon svgIcon="bookmark" class="icon-size-4.5" /><span class="max-sm:sr-only">{{ t('staffNav.marketplaceAdmin') }}</span>
                </a>
              }
            </nav>
            <button type="button" class="inline-flex min-h-11 cursor-pointer items-center px-2 text-[0.9375rem] text-[#E3ECE6]" [attr.lang]="i18n.lang() === 'ar' ? 'en' : 'ar'" (click)="i18n.toggle()">{{ t('landing.otherLanguage') }}</button>
            @if (auth.isAuthenticated()) {
              <a class="inline-flex min-h-11 items-center rounded-ui border border-[#BFE3CE] px-3 font-semibold whitespace-nowrap sm:px-4 text-white no-underline hover:bg-white/10" [routerLink]="auth.homeRoute()">{{ t('market.nav.myHome') }}</a>
            } @else {
              <a class="inline-flex min-h-11 items-center rounded-ui border border-[#BFE3CE] px-3 font-semibold whitespace-nowrap sm:px-4 text-white no-underline hover:bg-white/10" routerLink="/auth/sign-in">{{ t('market.nav.signIn') }}</a>
            }
          </div>
        </header>
        <main class="grow"><router-outlet /></main>
        <footer class="border-t border-line bg-page">
          <div class="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-sm text-muted lg:px-10">
            <aq-logo [size]="28" />
            @if (contactEmail) {
              <a class="text-secondary-600" [href]="'mailto:' + contactEmail + '?subject=' + reportSubject">{{ t('market.report') }}</a>
            }
          </div>
        </footer>
      </div>
    </ng-container>
  `,
})
export class PublicShell {
  protected auth = inject(AuthService);
  protected i18n = inject(I18nService);
  protected contactEmail = environment.contactEmail;
  protected reportSubject = encodeURIComponent('Report a page / الإبلاغ عن صفحة');

  constructor() {
    inject(LookupNames).load();
  }
}
