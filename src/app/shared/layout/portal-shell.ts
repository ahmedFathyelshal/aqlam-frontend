import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { NotificationBell } from '@/app/shared/components/notification-bell/notification-bell';
import { AqLogo } from '@/app/shared/ui/logo';
import { AqUserMenu } from '@/app/shared/ui/user-menu';

export type PortalNavItem = { key: string; icon: string; link: string; exact?: boolean };

/**
 * Shell for students and parents (phone-first): a top bar with the logo, links on larger screens,
 * and a bottom tab bar on phones.
 */
@Component({
  selector: 'aq-portal-shell',
  imports: [MatIconModule, RouterOutlet, RouterLink, RouterLinkActive, TranslocoDirective, AqLogo, AqUserMenu, NotificationBell],
  template: `
    <ng-container *transloco="let t">
      <div class="flex min-h-dvh flex-col bg-page">
        <header class="sticky top-0 z-30 border-b border-line bg-white">
          <div class="mx-auto flex h-16 max-w-6xl items-center gap-3 px-3 sm:px-6">
            <a [routerLink]="items()[0]?.link ?? '/'" class="no-underline"><aq-logo [size]="36" /></a>
            <nav class="ms-6 hidden items-center gap-1 sm:flex" [attr.aria-label]="t('nav.menu')">
              @for (item of items(); track item.link) {
                <a class="flex min-h-11 items-center gap-2 rounded-[6px] px-3 text-[0.95rem] font-medium text-ink no-underline hover:bg-neutral-100"
                   routerLinkActive="!bg-primary-100 !font-extrabold !text-primary-700" [routerLinkActiveOptions]="{ exact: !!item.exact }" [routerLink]="item.link">
                  <mat-icon [svgIcon]="item.icon" class="icon-size-5" />{{ t(item.key) }}
                </a>
              }
            </nav>
            <div class="flex-1"></div>
            <notification-bell />
            <aq-user-menu />
          </div>
        </header>

        <main class="flex-1 pb-24 sm:pb-6">
          <router-outlet />
        </main>

        <nav class="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-white pb-[env(safe-area-inset-bottom)] sm:hidden"
             [style.grid-template-columns]="'repeat(' + items().length + ', minmax(0, 1fr))'" [attr.aria-label]="t('nav.menu')">
          @for (item of items(); track item.link) {
            <a class="flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted no-underline"
               routerLinkActive="!font-extrabold !text-primary-600" [routerLinkActiveOptions]="{ exact: !!item.exact }" [routerLink]="item.link">
              <mat-icon [svgIcon]="item.icon" class="icon-size-5" />{{ t(item.key) }}
            </a>
          }
        </nav>
      </div>
    </ng-container>
  `,
})
export class AqPortalShell {
  readonly items = input<PortalNavItem[]>([]);
}
