import { Component, computed, inject } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { Permission } from '@/app/core/organizations/permissions';
import { User } from '@/app/domains/admin/layout/ui/user';

type NavItem = { label: string; icon: string; path: string; permission?: Permission; schoolOnly?: boolean };

const ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: 'layout-dashboard', path: 'dashboard' },
  { label: 'Classes & groups', icon: 'school', path: 'classes', permission: 'members.view', schoolOnly: true },
  { label: 'Announcements', icon: 'megaphone', path: 'announcements', permission: 'announcements.send', schoolOnly: true },
  { label: 'Question bank', icon: 'library', path: 'questions', permission: 'courses.edit' },
  { label: 'Members', icon: 'users', path: 'members', permission: 'members.view', schoolOnly: true },
  { label: 'Settings', icon: 'settings', path: 'settings', permission: 'org.settings' },
];

/** Navigation of the staff area, filtered by the permissions the user has in the active organization. */
@Component({
  selector: 'staff-sidebar',
  imports: [MatIcon, RouterLink, RouterLinkActive, User],
  host: { class: 'flex w-full flex-auto flex-col' },
  template: `
    <div class="flex items-center gap-x-2.5 px-6 pt-5">
      <img src="/images/logo/logo.svg" class="size-8" alt="" />
      @if (orgContext.activeOrg(); as org) {
        <div class="min-w-0">
          <div class="truncate text-lg leading-none font-bold">{{ org.name }}</div>
          <div class="text-xs text-neutral-500">{{ org.type }}</div>
        </div>
      }
    </div>

    <nav class="mt-8 flex flex-col gap-1 px-3">
      @for (item of items(); track item.path) {
        <a
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-neutral-700/10 dark:hover:bg-neutral-300/10"
          routerLinkActive="bg-primary-600/10 text-primary-600 dark:text-primary-400"
          [routerLink]="orgContext.path(item.path)"
        >
          <mat-icon class="icon-size-5" [svgIcon]="item.icon" />
          {{ item.label }}
        </a>
      }
    </nav>

    <div class="flex-auto"></div>
    <div class="p-2"><user /></div>
  `,
})
export class StaffSidebar {
  protected orgContext = inject(OrgContextService);

  /** Personal academies have no classes, members or announcements (a single teacher). */
  protected items = computed(() => {
    const org = this.orgContext.activeOrg();
    if (!org) return [];
    return ITEMS.filter(item => (!item.schoolOnly || org.type !== 'Personal') && (!item.permission || this.orgContext.can(item.permission)));
  });
}
