import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { AssessmentService, Submission } from '@/app/core/learning/assessment.service';
import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { formatOrgDate } from '@/app/core/organizations/org-date';
import { I18nService } from '@/app/core/transloco/i18n.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';

type GradeForm = { feedback: string; score: string };

/** Grading queue of a course: grade with feedback, or return the work for revision. */
@Component({
  selector: 'app-grading',
  imports: [MatIconModule, RouterLink, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <div class="page-narrow">
        <a class="back-link" [routerLink]="orgContext.path('courses', courseId, 'curriculum')"><mat-icon svgIcon="chevron-right" class="icon-size-4 ltr:rotate-180" />{{ t('qs.back') }}</a>
        <header class="page-header">
          <h1 class="page-title">{{ t('gr.title') }}</h1>
          <div class="segmented" role="group">
            <button type="button" class="segment" [attr.aria-pressed]="pendingOnly()" (click)="toggleFilter(true)">{{ t('gr.waiting') }}</button>
            <button type="button" class="segment" [attr.aria-pressed]="!pendingOnly()" (click)="toggleFilter(false)">{{ t('gr.all') }}</button>
          </div>
        </header>

        <div class="flex flex-col gap-4">
          @for (s of submissions(); track s.id) {
            @let form = forms()[s.id];
            <article class="card">
              <div class="card-header">
                <div class="min-w-0">
                  <p class="truncate font-extrabold">{{ s.studentName || s.studentUserName }}</p>
                  <p class="text-sm text-muted">{{ s.lessonTitle }} · {{ t('gr.submitted', { date: date(s.submittedAtUtc) }) }}</p>
                </div>
                <div class="flex gap-1.5">
                  @if (s.isLate) { <span class="badge badge-danger">{{ t('gr.late') }}</span> }
                  <span class="badge" [class]="s.status === 'Graded' ? 'badge-success' : s.status === 'ReturnedForRevision' ? 'badge-warning' : 'badge-info'">{{ t('hw.status.' + s.status) }}</span>
                </div>
              </div>
              <div class="card-body flex flex-col gap-3">
                @if (s.text) { <p class="rounded-ui bg-page p-3 text-[0.95rem] whitespace-pre-line">{{ s.text }}</p> }
                @for (link of s.links; track link) {
                  <a class="flex items-center gap-2 text-sm font-bold break-all" target="_blank" rel="noopener" [href]="link" dir="ltr"><mat-icon svgIcon="link" class="icon-size-4 shrink-0" />{{ link }}</a>
                }
                @if (form) {
                  <div class="grid gap-3 sm:grid-cols-[9rem_1fr]">
                    <label class="field">
                      <span class="field-label">{{ t('gr.score', { max: s.maxPoints }) }}</span>
                      <input type="number" class="input" min="0" [max]="s.maxPoints" inputmode="decimal" [value]="form.score" (input)="setForm(s.id, { score: $any($event.target).value })" />
                    </label>
                    <label class="field">
                      <span class="field-label">{{ t('gr.feedback') }}</span>
                      <textarea class="textarea min-h-12" maxlength="4000" [value]="form.feedback" (input)="setForm(s.id, { feedback: $any($event.target).value })"></textarea>
                    </label>
                  </div>
                }
                @if (errors()[s.id]; as message) { <div class="alert alert-danger" role="alert">{{ message }}</div> }
                <div class="flex flex-wrap justify-end gap-2">
                  <button type="button" class="btn btn-ghost" (click)="grade(s, true)">{{ t('gr.return') }}</button>
                  <button type="button" class="btn btn-primary" (click)="grade(s, false)">{{ t('gr.saveGrade') }}</button>
                </div>
              </div>
            </article>
          } @empty {
            <div class="empty"><mat-icon svgIcon="circle-check" class="icon-size-8" />{{ pendingOnly() ? t('gr.nothing') : t('gr.none') }}</div>
          }
        </div>
      </div>
    </ng-container>
  `,
})
export default class GradingComponent {
  protected orgContext = inject(OrgContextService);
  private assessments = inject(AssessmentService);
  private route = inject(ActivatedRoute);
  private transloco = inject(TranslocoService);
  private i18n = inject(I18nService);

  protected courseId = this.route.snapshot.paramMap.get('id')!;
  protected pendingOnly = signal(true);
  protected submissions = signal<Submission[]>([]);
  protected forms = signal<Record<string, GradeForm>>({});
  protected errors = signal<Record<string, string>>({});

  constructor() {
    this.load();
  }

  protected date(value: string): string {
    return formatOrgDate(value, 'Gregorian', { style: 'datetime', locale: this.i18n.lang() });
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
        this.errors.update(all => ({ ...all, [submission.id]: errorMessages(err, this.transloco.translate('gr.failed')).join(' ') })),
    });
  }

  private get org(): string {
    return this.orgContext.requireActiveSlug();
  }
}
