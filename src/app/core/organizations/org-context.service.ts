import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { ApiEndpoints } from '../constants/api-endpoints';
import { ApiResponse } from '../models/api-response.model';
import { grants, Permission } from './permissions';

export type OrganizationType = 'Personal' | 'Center' | 'School';

export type CalendarDisplay = 'Gregorian' | 'Hijri' | 'Both';

export type MembershipSummary = {
  organizationId: string;
  countryCode: string;
  slug: string;
  name: string;
  type: OrganizationType;
  roles: string[];
  timeZone?: string;
  calendar?: CalendarDisplay;
  weekStartDay?: string;
}

const STAFF_ROLES = ['Owner', 'Admin', 'AcademicCoordinator', 'Teacher', 'Assistant', 'Finance'];

/**
 * Organizations the signed-in user belongs to, and the one currently being worked in.
 * Tenant-scoped API calls are built from the active organization's slug (/api/orgs/{slug}/...).
 */
@Injectable({ providedIn: 'root' })
export class OrgContextService {
  private http = inject(HttpClient);

  readonly memberships = signal<MembershipSummary[]>([]);
  private readonly selectedSlug = signal<string | null>(null);

  /** Organizations where the user is staff (used by the teacher/admin area and the switcher). */
  readonly staffMemberships = computed(() =>
    this.memberships().filter(m => m.roles.some(r => STAFF_ROLES.includes(r)))
  );

  /** Explicit selection, otherwise the first staff organization (an independent teacher has exactly one). */
  readonly activeOrg = computed<MembershipSummary | null>(() => {
    const staff = this.staffMemberships();
    return staff.find(m => m.slug === this.selectedSlug()) ?? staff[0] ?? null;
  });

  /** Whether the user's roles in the active organization grant a permission (UI only; the API enforces it). */
  can(permission: Permission): boolean {
    const org = this.activeOrg();
    return !!org && grants(org.roles, permission);
  }

  /** Organizations where the user is a parent (parent portal). */
  readonly parentMemberships = computed(() => this.memberships().filter(m => m.roles.includes('Parent')));

  load(): Observable<MembershipSummary[]> {
    return this.http.get<ApiResponse<MembershipSummary[]>>(ApiEndpoints.Me.Memberships).pipe(
      map(response => response.data ?? []),
      tap(memberships => this.memberships.set(memberships))
    );
  }

  select(slug: string): void {
    this.selectedSlug.set(slug);
  }

  clear(): void {
    this.memberships.set([]);
    this.selectedSlug.set(null);
  }

  /**
   * Router commands for a page of the teacher area inside the active organization,
   * e.g. path('courses', id, 'edit') → ['/teacher', 'my-academy', 'courses', id, 'edit'].
   */
  path(...segments: (string | number)[]): (string | number)[] {
    return ['/teacher', this.requireActiveSlug(), ...segments];
  }

  /** Slug of the active organization; throws if the user has no staff organization. */
  requireActiveSlug(): string {
    const org = this.activeOrg();
    if (!org) {
      throw new Error('No active organization for the current user.');
    }
    return org.slug;
  }
}
