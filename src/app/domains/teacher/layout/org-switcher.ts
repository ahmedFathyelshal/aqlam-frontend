import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Router } from '@angular/router';
import { OrgContextService } from '@/app/core/organizations/org-context.service';

/**
 * Shows the organization being worked in. Users with several staff memberships (e.g. their own
 * academy plus a school) can switch; the choice is part of the URL, so other tabs are unaffected.
 */
@Component({
  selector: 'org-switcher',
  imports: [MatButtonModule, MatIconModule, MatMenuModule],
  template: `
    @if (orgContext.activeOrg(); as active) {
      @if (canSwitch()) {
        <button matButton [matMenuTriggerFor]="orgMenu" class="max-w-64">
          <span class="truncate font-medium">{{ active.name }}</span>
          <mat-icon iconPositionEnd svgIcon="chevron-down" />
        </button>
        <mat-menu #orgMenu="matMenu">
          @for (org of orgContext.staffMemberships(); track org.organizationId) {
            <button mat-menu-item (click)="switchTo(org.slug)" [disabled]="org.slug === active.slug">
              <span>{{ org.name }}</span>
              <span class="ms-2 text-sm text-neutral-500">{{ org.type }}</span>
            </button>
          }
        </mat-menu>
      } @else {
        <span class="truncate px-3 font-medium">{{ active.name }}</span>
      }
    }
  `,
})
export class OrgSwitcher {
  protected orgContext = inject(OrgContextService);
  private router = inject(Router);

  protected canSwitch = computed(() => this.orgContext.staffMemberships().length > 1);

  protected switchTo(slug: string): void {
    this.router.navigate(['/teacher', slug, 'dashboard']);
  }
}
