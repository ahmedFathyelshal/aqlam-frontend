import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { map } from 'rxjs';

import { AuthService } from '@/app/core/auth/auth.service';
import { ApiEndpoints } from '@/app/core/constants/api-endpoints';
import { ApiResponse } from '@/app/core/models/api-response.model';
import { OrgContextService } from '@/app/core/organizations/org-context.service';

/** Row of the organization's course list. */
export type CourseSummary = {
  chapterCount: number;
  id: string;
  lessonCount: number;
  status: string;
  title: string;
  visibility: string;
};

@Component({
  selector: 'teacher-dashboard',
  standalone: true,
  imports: [TranslocoDirective, MatButtonModule, MatIconModule, MatRippleModule, RouterLink],
  templateUrl: './dashboard.component.html'
})
export default class TeacherDashboardComponent {
  public authService = inject(AuthService);
  protected orgContext = inject(OrgContextService);
  private http = inject(HttpClient);

  protected courses = signal<CourseSummary[]>([]);

  // Placeholder until sessions/scheduling exist (Epic 10).
  upcomingSessions = [
    { id: 1, title: 'Calculus Q&A', time: '10:00 AM', date: 'Today' },
    { id: 2, title: 'Quantum Mechanics Intro', time: '02:00 PM', date: 'Tomorrow' },
  ];

  constructor() {
    this.http
      .get<ApiResponse<CourseSummary[]>>(ApiEndpoints.TeacherCourses.List(this.orgContext.requireActiveSlug()))
      .pipe(map(response => response.data ?? []))
      .subscribe({ next: courses => this.courses.set(courses), error: () => this.courses.set([]) });
  }
}
