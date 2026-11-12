import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoDirective } from '@jsverse/transloco';
import { filter } from 'rxjs';

import { MembershipSummary, OrgContextService } from '@/app/core/organizations/org-context.service';
import { formatOrgDate, todayIn } from '@/app/core/organizations/org-date';
import { Permission } from '@/app/core/organizations/permissions';
import { I18nService } from '@/app/core/transloco/i18n.service';
import { NotificationBell } from '@/app/shared/components/notification-bell/notification-bell';
import { AqLogo } from '@/app/shared/ui/logo';
import { AqOrgMark } from '@/app/shared/ui/org-mark';
import { AqUserMenu } from '@/app/shared/ui/user-menu';

type NavItem = { key: string; icon: string; path: string; permission?: Permission; mobile?: boolean };
type NavGroup = { key: string; items: NavItem[] };

const ROLE_ORDER = ['Owner', 'Admin', 'AcademicCoordinator', 'Teacher', 'Assistant', 'Finance'];

/**
 * Staff area shell in مداد: a deep ink side menu (laptop) or drawer (tablet/phone) that sets the staff tool apart
 * from the student and parent portals; the school's own mark heads it and doubles as the organization switcher.
 * Phones also get a white bottom bar with the main sections.
 */
@Component({
  selector: 'teacher-layout',
  imports: [NgTemplateOutlet, MatIconModule, MatMenuModule, RouterOutlet, RouterLink, RouterLinkActive, TranslocoDirective, AqLogo, AqOrgMark, AqUserMenu, NotificationBell],
  template: `
    <ng-container *transloco="let t">
      <ng-template #menu>
        <div class="flex h-full flex-col text-white">
          @if (orgContext.activeOrg(); as org) {
            <div class="border-b border-white/10 p-3">
              @if (orgContext.staffMemberships().length > 1) {
                <button type="button" class="flex min-h-14 w-full cursor-pointer items-center gap-2.5 rounded-ui px-2 text-start hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-white"
                        [matMenuTriggerFor]="orgs" [attr.aria-label]="t('shell.switchOrg') + ': ' + org.name">
                  <ng-container [ngTemplateOutlet]="orgHead" [ngTemplateOutletContext]="{ $implicit: org }" />
                  <mat-icon svgIcon="chevrons-up-down" class="icon-size-4 shrink-0 text-white/60" />
                </button>
                <mat-menu #orgs="matMenu" xPosition="after">
                  @for (o of orgContext.staffMemberships(); track o.organizationId) {
                    <button mat-menu-item [disabled]="o.slug === org.slug" (click)="switchTo(o)">
                      <span class="flex flex-col py-1 leading-snug">
                        <span class="font-bold">{{ o.name }}</span>
                        <span class="text-sm text-muted">{{ t('orgType.' + o.type) }} · {{ t('role.' + topRole(o)) }}</span>
                      </span>
                    </button>
                  }
                </mat-menu>
              } @else {
                <div class="flex min-h-14 items-center gap-2.5 px-2">
                  <ng-container [ngTemplateOutlet]="orgHead" [ngTemplateOutletContext]="{ $implicit: org }" />
                </div>
              }
            </div>
          }

          <nav class="flex flex-1 flex-col overflow-y-auto px-3 pb-3" [attr.aria-label]="t('nav.menu')">
            @for (group of groups(); track group.key) {
              <div class="mt-4">
                <p class="mb-1 px-3 text-xs font-bold text-white/60">{{ t(group.key) }}</p>
                @for (item of group.items; track item.path) {
                  <ng-container [ngTemplateOutlet]="link" [ngTemplateOutletContext]="{ $implicit: item }" />
                }
              </div>
            }
            <div class="flex-1"></div>
            @if (settings(); as item) {
              <div class="mt-4 border-t border-white/10 pt-3">
                <ng-container [ngTemplateOutlet]="link" [ngTemplateOutletContext]="{ $implicit: item }" />
              </div>
            }
          </nav>
          <div class="px-5 pb-5 opacity-60"><aq-logo [size]="24" [inverse]="true" /></div>
        </div>
      </ng-template>

      <ng-template #orgHead let-org>
        <aq-org-mark [name]="org.name" [logoUrl]="org.logoUrl" [size]="40" />
        <span class="min-w-0 flex-1">
          <span class="block truncate font-bold">{{ org.name }}</span>
          <span class="block truncate text-sm text-white/65">{{ t('orgType.' + org.type) }}</span>
        </span>
      </ng-template>

      <ng-template #link let-item>
        <a class="relative mb-0.5 flex min-h-11 items-center gap-3 rounded-ui px-3 text-[0.95rem] font-medium text-white/80 no-underline hover:bg-white/8 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
           routerLinkActive="!bg-white/12 !font-bold !text-white before:absolute before:inset-y-2 before:start-0 before:w-[3px] before:rounded-full before:bg-primary-300"
           [routerLink]="orgContext.path(item.path)" (click)="drawer.set(false)">
          <mat-icon [svgIcon]="item.icon" class="icon-size-5" />{{ t(item.key) }}
        </a>
      </ng-template>

      <div class="min-h-dvh bg-page lg:flex">
        <!-- Side menu (laptop) -->
        <aside class="sticky top-0 hidden h-dvh w-64 shrink-0 bg-deep lg:block print:hidden">
          <ng-container [ngTemplateOutlet]="menu" />
        </aside>

        <!-- Drawer (tablet / phone) -->
        @if (drawer()) {
          <div class="fixed inset-0 z-40 bg-ink/40 lg:hidden" (click)="drawer.set(false)" aria-hidden="true"></div>
          <aside class="fixed inset-y-0 start-0 z-50 flex w-72 max-w-[85vw] flex-col bg-deep shadow-xl lg:hidden" role="dialog" aria-modal="true" [attr.aria-label]="t('nav.menu')">
            <div class="flex justify-end p-2">
              <button type="button" class="inline-flex size-11 cursor-pointer items-center justify-center rounded-ui text-white hover:bg-white/10" [attr.aria-label]="t('action.close')" (click)="drawer.set(false)"><mat-icon svgIcon="x" class="icon-size-5" /></button>
            </div>
            <div class="min-h-0 flex-1"><ng-container [ngTemplateOutlet]="menu" /></div>
          </aside>
        }

        <div class="flex min-w-0 flex-1 flex-col">
          <header class="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-white px-3 sm:px-5 lg:px-8 print:hidden">
            <button type="button" class="btn-icon lg:hidden" [attr.aria-label]="t('nav.menu')" (click)="drawer.set(true)"><mat-icon svgIcon="menu" class="icon-size-5" /></button>
            @if (orgContext.activeOrg(); as org) {
              <span class="flex min-w-0 items-center gap-2 lg:hidden">
                <aq-org-mark [name]="org.name" [logoUrl]="org.logoUrl" [size]="32" />
                <span class="truncate font-bold text-deep">{{ org.name }}</span>
              </span>
            }
            <div class="flex-1"></div>
            <span class="hidden text-sm text-muted lg:inline">{{ today() }}</span>
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
            <a class="relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted no-underline"
               routerLinkActive="!font-bold !text-deep before:absolute before:top-0 before:h-[3px] before:w-8 before:rounded-b-full before:bg-primary-600"
               [routerLink]="orgContext.path(item.path)">
              <mat-icon [svgIcon]="item.icon" class="icon-size-5" />{{ t(item.key) }}
            </a>
          }
          <button type="button" class="flex min-h-14 cursor-pointer flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted" (click)="drawer.set(true)">
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

  /** Owners, admins and coordinators of a school start at the overview; their course list sits under Teaching. */
  private runsOrg = computed(() => {
    const org = this.orgContext.activeOrg();
    return !!org && this.orgContext.homePath(org).at(-1) === 'overview';
  });

  protected groups = computed<NavGroup[]>(() => {
    const org = this.orgContext.activeOrg();
    if (!org) return [];
    const allowed = (i: NavItem) => !i.permission || this.orgContext.can(i.permission);
    const runs = this.runsOrg();
    const groups: NavGroup[] = [
      {
        key: 'navGroup.today',
        items: runs
          ? [{ key: 'shell.overview', icon: 'layout-dashboard', path: 'overview', mobile: true }]
          : [{ key: 'nav.home', icon: 'layout-dashboard', path: 'dashboard', mobile: true }],
      },
    ];
    if (org.type !== 'Personal') {
      groups.push({
        key: org.type === 'Center' ? 'navGroup.center' : 'navGroup.school',
        items: ([
          { key: org.type === 'Center' ? 'nav.groups' : 'nav.classes', icon: 'school', path: 'classes', permission: 'members.view', mobile: true },
          { key: 'nav.members', icon: 'users', path: 'members', permission: 'members.view' },
          { key: 'nav.academicYears', icon: 'calendar-range', path: 'academic-years', permission: 'classes.manage' },
          { key: 'nav.announcements', icon: 'megaphone', path: 'announcements', permission: 'announcements.send', mobile: !runs },
        ] satisfies NavItem[] as NavItem[]).filter(allowed),
      });
    }
    groups.push({
      key: 'navGroup.teaching',
      items: [
        ...(runs ? [{ key: 'shell.courses', icon: 'book-open', path: 'dashboard', permission: 'courses.view' as Permission, mobile: true }] : []),
        { key: 'nav.questions', icon: 'library', path: 'questions', permission: 'courses.edit' as Permission },
      ].filter(allowed),
    });
    // Marketplace: the independent teacher's public page; earnings for anyone who sells (not schools).
    if (org.type !== 'School') {
      groups.push({
        key: 'staffNav.group',
        items: ([
          ...(org.type === 'Personal' ? [{ key: 'staffNav.publicPage', icon: 'user-round', path: 'public-page', permission: 'org.settings' as Permission }] : []),
          { key: 'staffNav.earnings', icon: 'wallet', path: 'earnings', permission: 'finance.view' as Permission },
        ] satisfies NavItem[] as NavItem[]).filter(allowed),
      });
    }
    return groups.filter(g => g.items.length);
  });

  protected settings = computed<NavItem | null>(() =>
    this.orgContext.can('org.settings') ? { key: 'nav.settings', icon: 'settings', path: 'settings' } : null);

  protected mobileItems = computed(() => this.groups().flatMap(g => g.items).filter(i => i.mobile).slice(0, 4));

  protected today = computed(() => {
    const org = this.orgContext.activeOrg();
    return formatOrgDate(todayIn(org?.timeZone), org?.calendar ?? 'Gregorian', { locale: this.i18n.lang() });
  });

  constructor() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => this.drawer.set(false));
  }

  protected topRole(org: MembershipSummary): string {
    return ROLE_ORDER.find(r => org.roles.includes(r)) ?? org.roles[0] ?? 'Teacher';
  }

  protected switchTo(org: MembershipSummary): void {
    this.router.navigate(this.orgContext.homePath(org));
  }
}
