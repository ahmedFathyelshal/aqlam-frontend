import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { map, Observable, tap } from 'rxjs';

import { ApiEndpoints } from '../constants/api-endpoints';
import { ApiResponse } from '../models/api-response.model';

export type ChildOrganization = { organizationId: string; slug: string; name: string };
export type Child = { userId: string; userName: string; fullName: string; organizations: ChildOrganization[] };

/** Set by each school in its settings. */
export type SummaryRules = { followUpAbsentDays: number; followUpLateDays: number; goodGradePercent: number; lowGradePercent: number };

export type ChildOverview = {
  userId: string;
  fullName: string;
  classes: string[];
  courses: { courseId: string; title: string; progressPercent: number; lastAccessedAtUtc: string | null }[];
  attendance: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    recent: { date: string; startTime: string | null; className: string; status: string; note: string | null }[];
    /** The latest school days, oldest first; a day with several sessions shows its most serious status. */
    days: { date: string; status: string }[];
  };
  school: { name: string; logoUrl: string | null; contactPhone: string | null; contactEmail: string | null; summaryRules: SummaryRules };
  grades: { kind: 'Quiz' | 'Assignment'; courseId: string; lessonTitle: string | null; score: number | null; maxScore: number; percent: number | null; status: string; atUtc: string }[];
};

export type AppNotification = {
  id: string;
  organizationId: string | null;
  organizationName: string | null;
  type: 'Announcement' | 'Absence' | 'Late';
  title: string;
  body: string;
  link: string | null;
  createdAtUtc: string;
  isRead: boolean;
};

/** Parent portal: linked children and their read-only overview. */
@Injectable({ providedIn: 'root' })
export class FamilyService {
  private http = inject(HttpClient);

  children(): Observable<Child[]> {
    return this.http.get<ApiResponse<Child[]>>(ApiEndpoints.Me.Children).pipe(map(r => r.data));
  }

  /** A parent creates a child's account (required under 13) and is linked to it. */
  createChild(input: { userName: string; password: string; fullName: string | null; birthYear: number }): Observable<Child> {
    return this.http.post<ApiResponse<Child>>(`${ApiEndpoints.Me.Children}/new`, input).pipe(map(r => r.data));
  }

  /** A student's family code for a parent (the open one is returned again). */
  familyInvite(): Observable<{ code: string; childName: string; expiresAtUtc: string }> {
    return this.http.post<ApiResponse<{ code: string; childName: string; expiresAtUtc: string }>>(ApiEndpoints.Me.Children.replace('/children', '/family-invite'), null)
      .pipe(map(r => r.data));
  }

  linkChild(code: string): Observable<Child> {
    return this.http.post<ApiResponse<Child>>(ApiEndpoints.Me.Children, { code }).pipe(map(r => r.data));
  }

  overview(org: string, childId: string): Observable<ChildOverview> {
    return this.http.get<ApiResponse<ChildOverview>>(ApiEndpoints.School.Child(org, childId)).pipe(map(r => r.data));
  }
}

/** The signed-in user's notification inbox (shared by every area's header bell). */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);

  readonly items = signal<AppNotification[]>([]);
  readonly unreadCount = signal(0);

  refresh(): Observable<unknown> {
    return this.http.get<ApiResponse<{ unreadCount: number; items: AppNotification[] }>>(ApiEndpoints.Me.Notifications()).pipe(
      map(r => r.data),
      tap(page => {
        this.items.set(page.items);
        this.unreadCount.set(page.unreadCount);
      })
    );
  }

  markRead(notification: AppNotification): Observable<unknown> {
    return this.http.post(ApiEndpoints.Me.NotificationRead(notification.id), {}).pipe(
      tap(() => {
        this.items.update(all => all.map(n => (n.id === notification.id ? { ...n, isRead: true } : n)));
        this.unreadCount.update(c => Math.max(0, c - (notification.isRead ? 0 : 1)));
      })
    );
  }

  markAllRead(): Observable<unknown> {
    return this.http.post(ApiEndpoints.Me.NotificationsReadAll, {}).pipe(
      tap(() => {
        this.items.update(all => all.map(n => ({ ...n, isRead: true })));
        this.unreadCount.set(0);
      })
    );
  }
}
