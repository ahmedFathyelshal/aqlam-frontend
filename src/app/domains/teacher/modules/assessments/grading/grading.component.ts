import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AssessmentService, Submission } from '@/app/core/learning/assessment.service';
import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { ApiValidationError } from '@/app/core/utils/api-error.utils';

type GradeForm = { feedback: string; score: string };

/** Grading queue of a course: grade with feedback, or return the work for revision. */
@Component({
  selector: 'app-grading',
  imports: [DatePipe, MatButtonModule, RouterLink],
  templateUrl: './grading.component.html',
})
export default class GradingComponent {
  protected orgContext = inject(OrgContextService);
  private assessments = inject(AssessmentService);
  private route = inject(ActivatedRoute);

  protected courseId = this.route.snapshot.paramMap.get('id')!;
  protected pendingOnly = signal(true);
  protected submissions = signal<Submission[]>([]);
  protected forms = signal<Record<string, GradeForm>>({});
  protected errors = signal<Record<string, string>>({});

  constructor() {
    this.load();
  }

  protected load(): void {
    this.assessments.submissions(this.org, this.courseId, this.pendingOnly()).subscribe(list => {
      this.submissions.set(list);
      this.forms.set(Object.fromEntries(list.map(s => [s.id, { score: s.score?.toString() ?? '', feedback: s.feedback ?? '' }])));
    });
  }

  protected toggleFilter(pendingOnly: boolean): void {
    this.pendingOnly.set(pendingOnly);
    this.load();
  }

  protected setForm(id: string, changes: Partial<GradeForm>): void {
    this.forms.update(all => ({ ...all, [id]: { ...all[id], ...changes } }));
  }

  protected grade(submission: Submission, returnForRevision: boolean): void {
    const form = this.forms()[submission.id];
    const score = returnForRevision || form.score.trim() === '' ? null : +form.score;
    this.assessments.grade(this.org, submission.id, { score, feedback: form.feedback.trim() || null, returnForRevision }).subscribe({
      next: () => this.load(),
      error: (err: unknown) =>
        this.errors.update(all => ({
          ...all,
          [submission.id]: err instanceof ApiValidationError ? err.errors.join(' • ') : 'The grade could not be saved.',
        })),
    });
  }

  private get org(): string {
    return this.orgContext.requireActiveSlug();
  }
}
