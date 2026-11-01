import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';

import { LearningService, MyCourse } from '@/app/core/learning/learning.service';
import { OrgContextService } from '@/app/core/organizations/org-context.service';

/** Student home: courses across all organizations (school, centers, teachers) and joining with a code. */
@Component({
  selector: 'student-dashboard',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatProgressBarModule, RouterLink],
  templateUrl: './dashboard.component.html',
})
export default class StudentDashboardComponent {
  private learning = inject(LearningService);
  private orgContext = inject(OrgContextService);

  protected courses = signal<MyCourse[] | null>(null);
  protected joinCode = signal('');
  protected joining = signal(false);
  protected joinMessage = signal<{ kind: 'error' | 'success'; text: string } | null>(null);

  constructor() {
    this.loadCourses();
  }

  protected courseLink(course: MyCourse): string[] {
    return course.lastLessonId
      ? ['/learn', course.organizationSlug, course.courseId, course.lastLessonId]
      : ['/learn', course.organizationSlug, course.courseId];
  }

  protected join(): void {
    const code = this.joinCode().trim();
    if (!code) return;

    this.joining.set(true);
    this.joinMessage.set(null);
    this.learning.joinWithCode(code).subscribe({
      next: result => {
        this.joining.set(false);
        this.joinCode.set('');
        this.joinMessage.set({
          kind: 'success',
          text: result.membershipStatus === 'Pending'
            ? `Request sent to ${result.name}. You will get access once they approve it.`
            : `You joined ${result.name}.`,
        });
        this.orgContext.load().subscribe();
      },
      error: (err: unknown) => {
        this.joining.set(false);
        const text = err instanceof HttpErrorResponse && err.status === 409
          ? 'You are already a member.'
          : err instanceof HttpErrorResponse && err.status === 429
            ? 'Too many attempts. Please wait a minute.'
            : 'This code is not valid.';
        this.joinMessage.set({ kind: 'error', text });
      },
    });
  }

  private loadCourses(): void {
    this.learning.myCourses().subscribe({
      next: courses => this.courses.set(courses),
      error: () => this.courses.set([]),
    });
  }
}
