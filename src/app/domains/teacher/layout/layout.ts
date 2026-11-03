import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoDirective } from '@jsverse/transloco';
import { filter } from 'rxjs';

import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { formatOrgDate, todayIn } from '@/app/core/organizations/org-date';
import { Permission } from '@/app/core/organizations/permissions';
import { I18nService } from '@/app/core/transloco/i18n.service';
import { NotificationBell } from '@/app/shared/components/notification-bell/notification-bell';
import { AqLogo } from '@/app/shared/ui/logo';
import { AqUserMenu } from '@/app/shared/ui/user-menu';

type NavItem = { key: string; icon: string; path: string; permission?: Permission; schoolOnly?: boolean; mobile?: boolean };

const ITEMS: NavItem[] = [
  { key: 'nav.dashboard', icon: 'layout-dashboard', path: 'dashboard', mobile: true },
  { key: 'nav.classes', icon: 'school', path: 'classes', permission: 'members.view', schoolOnly: true, mobile: true },
  { key: 'nav.announcements', icon: 'megaphone', path: 'announcements', permission: 'announcements.send', schoolOnly: true, mobile: true },
  { key: 'nav.questions', icon: 'library', path: 'questions', permission: 'courses.edit' },
  { key: 'nav.members', icon: 'users', path: 'members', permission: 'members.view', schoolOnly: true },
  { key: 'nav.settings', icon: 'settings', path: 'settings', permission: 'org.settings' },
];

/**
 * Staff area shell. Laptop: fixed side menu. Tablet/phone: the menu slides in as a drawer;
 * phones also get a bottom bar with the main sections.
 */
@Component({
  selector: 'teacher-layout',
  imports: [NgTemplateOutlet, MatIconModule, MatMenuModule, RouterOutlet, RouterLink, RouterLinkActive, TranslocoDirective, AqLogo, AqUserMenu, NotificationBell],
  template: `
    <ng-container *transloco="let t">
      <ng-template #menu>
        <div class="flex h-full flex-col gap-5 p-4">
          @if (orgContext.activeOrg(); as org) {
            <div class="flex items-center gap-2.5 px-1">
              <aq-logo [size]="40" [wordmark]="false" />
              <div class="min-w-0 flex-1">
                <div class="truncate font-extrabold">{{ org.name }}</div>
                <div class="text-sm text-muted">{{ t('orgType.' + org.type) }}</div>
              </div>
            </div>
            @if (orgContext.staffMemberships().length > 1) {
              <button type="button" class="btn btn-secondary btn-sm" [matMenuTriggerFor]="orgs">{{ t('action.changeOrganization') }}</button>
              <mat-menu #orgs="matMenu">
                @for (o of orgContext.staffMemberships(); track o.organizationId) {
                  <button mat-menu-item [disabled]="o.slug === org.slug" (click)="switchTo(o.slug)">
                    {{ o.name }} <span class="text-sm text-muted">· {{ t('orgType.' + o.type) }}</span>
                  </button>
                }
              </mat-menu>
            }
          }
          <nav class="flex flex-col gap-0.5" [attr.aria-label]="t('nav.menu')">
            @for (item of items(); track item.path) {
              <a
                class="flex min-h-11 items-center gap-3 rounded-[6px] px-3 text-[0.95rem] font-medium text-ink no-underline hover:bg-neutral-100"
                routerLinkActive="!bg-primary-100 !font-extrabold !text-primary-700"
                [routerLink]="orgContext.path(item.path)"
                (click)="drawer.set(false)"
              >
                <mat-icon [svgIcon]="item.icon" class="icon-size-5" />{{ t(item.key) }}
              </a>
            }
          </nav>
          <div class="flex-1"></div>
          <aq-logo [size]="28" class="px-1 opacity-80" />
        </div>
      </ng-template>

      <div class="min-h-dvh bg-page lg:flex">
        <!-- Side menu (laptop) -->
        <aside class="sticky top-0 hidden h-dvh w-64 shrink-0 border-e border-line bg-white lg:block print:hidden">
          <ng-container [ngTemplateOutlet]="menu" />
        </aside>

        <!-- Drawer (tablet / phone) -->
        @if (drawer()) {
          <div class="fixed inset-0 z-40 bg-ink/40 lg:hidden" (click)="drawer.set(false)" aria-hidden="true"></div>
          <aside class="fixed inset-y-0 start-0 z-50 w-72 max-w-[85vw] overflow-y-auto bg-white shadow-xl lg:hidden" role="dialog" aria-modal="true" [attr.aria-label]="t('nav.menu')">
            <div class="flex justify-end p-2">
              <button type="button" class="btn-icon" [attr.aria-label]="t('action.close')" (click)="drawer.set(false)"><mat-icon svgIcon="x" class="icon-size-5" /></button>
            </div>
            <ng-container [ngTemplateOutlet]="menu" />
          </aside>
        }

        <div class="flex min-w-0 flex-1 flex-col">
          <header class="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-white px-3 sm:px-5 lg:px-8 print:hidden">
            <button type="button" class="btn-icon lg:hidden" [attr.aria-label]="t('nav.menu')" (click)="drawer.set(true)"><mat-icon svgIcon="menu" class="icon-size-5" /></button>
            <span class="truncate font-extrabold lg:hidden">{{ orgContext.activeOrg()?.name }}</span>
            <div class="flex-1"></div>
            <span class="hidden text-sm text-muted xl:inline">{{ today() }}</span>
            <notification-bell />
            <aq-user-menu />
          </header>

          <main class="flex-1 pb-24 lg:pb-0">
            <router-outlet />
          </main>
        </div>

        <!-- Bottom bar (phone) -->
        <nav class="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-white pb-[env(safe-area-inset-bottom)] sm:hidden print:hidden" [style.grid-template-columns]="'repeat(' + (mobileItems().length + 1) + ', minmax(0, 1fr))'" [attr.aria-label]="t('nav.menu')">
          @for (item of mobileItems(); track item.path) {
            <a class="flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted no-underline" routerLinkActive="!font-extrabold !text-primary-600" [routerLink]="orgContext.path(item.path)">
              <mat-icon [svgIcon]="item.icon" class="icon-size-5" />{{ t(item.key) }}
            </a>
          }
          <button type="button" class="flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted" (click)="drawer.set(true)">
            <mat-icon svgIcon="menu" class="icon-size-5" />{{ t('nav.more') }}
          </button>
        </nav>
      </div>
    </ng-container>
  `,
})
export class TeacherLayout {
  protected orgContext = inject(OrgContextService);
  private i18n = inject(I18nService);
  private router = inject(Router);

  protected drawer = signal(false);

  /** Personal academies have no classes, members or announcements (a single teacher). */
  protected items = computed(() => {
    const org = this.orgContext.activeOrg();
    if (!org) return [];
    return ITEMS.filter(i => (!i.schoolOnly || org.type !== 'Personal') && (!i.permission || this.orgContext.can(i.permission)));
  });
  protected mobileItems = computed(() => this.items().filter(i => i.mobile));

  protected today = computed(() => {
    const org = this.orgContext.activeOrg();
    return formatOrgDate(todayIn(org?.timeZone), org?.calendar ?? 'Gregorian', { locale: this.i18n.lang() });
  });

  constructor() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => this.drawer.set(false));
  }

  protected switchTo(slug: string): void {
    this.router.navigate(['/teacher', slug, 'dashboard']);
  }
}
