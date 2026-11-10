import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { ApiEndpoints } from '../constants/api-endpoints';
import { ApiResponse } from '../models/api-response.model';
import { LocalStorage } from '../local-storage/local-storage';
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
  logoUrl?: string | null;
}

const STAFF_ROLES = ['Owner', 'Admin', 'AcademicCoordinator', 'Teacher', 'Assistant', 'Finance'];

/** Higher means the person runs more of the organization; used to pick where they land. */
const ROLE_WEIGHT: Record<string, number> = { Owner: 5, Admin: 4, AcademicCoordinator: 3, Teacher: 2, Assistant: 1, Finance: 1 };
const LAST_ORG_KEY = 'aq.lastOrg';

/**
 * A school or center always comes before a personal academy (every teacher owns one, created for them),
 * then the highest role: an owner of one school and teacher in another lands where they own.
 */
function rank(m: MembershipSummary): number {
  const role = Math.max(0, ...m.roles.map(r => ROLE_WEIGHT[r] ?? 0));
  return (m.type === 'Personal' ? 0 : 10) + role;
}

/**
 * Organizations the signed-in user belongs to, and the one currently being worked in.
 * Tenant-scoped API calls are built from the active organization's slug (/api/orgs/{slug}/...).
 */
@Injectable({ providedIn: 'root' })
export class OrgContextService {
  private http = inject(HttpClient);
  private storage = inject(LocalStorage);

  readonly memberships = signal<MembershipSummary[]>([]);
  private readonly selectedSlug = signal<string | null>(null);

  /** Organizations where the user is staff (used by the teacher/admin area and the switcher). */
  readonly staffMemberships = computed(() =>
    this.memberships().filter(m => m.roles.some(r => STAFF_ROLES.includes(r)))
  );

  /**
   * Where the user lands: the organization they last worked in on this device, otherwise the one where they
   * hold the highest role. A school owner who also has a personal academy lands in the school.
   */
  readonly defaultOrg = computed<MembershipSummary | null>(() => {
    const staff = this.staffMemberships();
    const last = this.storage.getItem(LAST_ORG_KEY);
    return staff.find(m => m.slug === last)
      ?? staff.reduce<MembershipSummary | null>((best, m) => (!best || rank(m) > rank(best) ? m : best), null);
  });

  /** Explicit selection, otherwise the default organization. */
  readonly activeOrg = computed<MembershipSummary | null>(() =>
    this.staffMemberships().find(m => m.slug === this.selectedSlug()) ?? this.defaultOrg()
  );

  /** First page of an organization: the overview for people who run a school or center, the teacher home otherwise. */
  homePath(org: MembershipSummary): string[] {
    const page = org.type !== 'Personal' && grants(org.roles, 'classes.manage') ? 'overview' : 'dashboard';
    return ['/teacher', org.slug, page];
  }

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
    this.storage.setItem(LAST_ORG_KEY, slug);
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
