import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { MembershipSummary, OrgContextService } from './org-context.service';

const personal: MembershipSummary = {
  organizationId: '1', slug: 'my-academy', name: 'My Academy', type: 'Personal', countryCode: 'SA', roles: ['Owner', 'Teacher'],
};
const school: MembershipSummary = {
  organizationId: '2', slug: 'nile-school', name: 'Nile School', type: 'School', countryCode: 'SA', roles: ['Teacher'],
};
const studentOnly: MembershipSummary = {
  organizationId: '3', slug: 'center', name: 'Center', type: 'Center', countryCode: 'EG', roles: ['Student'],
};

describe('OrgContextService', () => {
  let service: OrgContextService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear(); // the last chosen organization is remembered per device
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(OrgContextService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function loadMemberships(memberships: MembershipSummary[]) {
    service.load().subscribe();
    http.expectOne(req => req.url.endsWith('/me/memberships')).flush({ succeeded: true, errors: [], data: memberships });
  }

  it('lands a teacher in the school, not the personal academy, and ignores student-only memberships', () => {
    loadMemberships([studentOnly, personal, school]);

    expect(service.staffMemberships().map(m => m.slug)).toEqual(['my-academy', 'nile-school']);
    expect(service.activeOrg()?.slug).toBe('nile-school');
    expect(service.homePath(service.activeOrg()!)).toEqual(['/teacher', 'nile-school', 'dashboard']);
  });

  it('lands an owner where they own, on the overview', () => {
    const ownedCenter: MembershipSummary = { ...studentOnly, slug: 'own-center', roles: ['Owner'] };
    loadMemberships([personal, school, ownedCenter]);

    expect(service.activeOrg()?.slug).toBe('own-center');
    expect(service.homePath(service.activeOrg()!)).toEqual(['/teacher', 'own-center', 'overview']);
  });

  it('keeps a personal academy on the teacher home', () => {
    loadMemberships([personal]);

    expect(service.homePath(personal)).toEqual(['/teacher', 'my-academy', 'dashboard']);
  });

  it('returns to the organization last chosen on this device', () => {
    loadMemberships([personal, school]);
    service.select('my-academy');
    service.clear();

    loadMemberships([personal, school]);

    expect(service.activeOrg()?.slug).toBe('my-academy');
  });

  it('switches to an explicitly selected organization', () => {
    loadMemberships([personal, school]);

    service.select('nile-school');

    expect(service.activeOrg()?.slug).toBe('nile-school');
    expect(service.path('courses', 'abc', 'edit')).toEqual(['/teacher', 'nile-school', 'courses', 'abc', 'edit']);
  });

  it('ignores a selection that is not one of the user\'s staff organizations', () => {
    loadMemberships([personal, studentOnly]);

    service.select('center');

    expect(service.activeOrg()?.slug).toBe('my-academy');
  });

  it('throws when the user has no staff organization', () => {
    loadMemberships([studentOnly]);

    expect(() => service.requireActiveSlug()).toThrow();
  });

  it('clears everything on sign-out', () => {
    loadMemberships([personal]);

    service.clear();

    expect(service.memberships()).toEqual([]);
    expect(service.activeOrg()).toBeNull();
  });
});
