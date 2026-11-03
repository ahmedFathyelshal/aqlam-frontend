import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { AssessmentService } from '@/app/core/learning/assessment.service';
import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';

/** Converts between an ISO UTC string and the value of a datetime-local input (local time). */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

/** Points, due date and late-work policy of an Assignment lesson (instructions are the lesson content). */
@Component({
  selector: 'app-assignment-setup',
  imports: [MatIconModule, RouterLink, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <div class="page-narrow">
        <a class="back-link" [routerLink]="orgContext.path('courses', courseId, 'curriculum')"><mat-icon svgIcon="chevron-right" class="icon-size-4 ltr:rotate-180" />{{ t('qs.back') }}</a>
        <header class="page-header">
          <div>
            <h1 class="page-title">{{ t('as.title') }}</h1>
            <p class="page-subtitle">{{ t('as.intro') }}</p>
          </div>
        </header>

        <section class="card card-body flex flex-col gap-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="field">
              <span class="field-label">{{ t('as.maxPoints') }}</span>
              <input type="number" class="input" min="1" inputmode="numeric" [value]="maxPoints()" (input)="maxPoints.set(+$any($event.target).value)" />
            </label>
            <label class="field">
              <span class="field-label">{{ t('as.due') }}</span>
              <input type="datetime-local" class="input" [value]="dueLocal()" (input)="dueLocal.set($any($event.target).value)" />
            </label>
          </div>
          <label class="check"><input type="checkbox" [checked]="acceptLate()" (change)="acceptLate.set($any($event.target).checked)" />{{ t('as.acceptLate') }}</label>
          @if (errors().length) { <div class="alert alert-danger" role="alert">{{ errors().join(' ') }}</div> }
          @if (saved()) { <div class="alert alert-success" role="status">{{ t('as.saved') }}</div> }
          <div class="flex flex-wrap justify-end gap-2">
            <a class="btn btn-ghost" [routerLink]="orgContext.path('courses', courseId, 'submissions')">{{ t('gr.title') }}</a>
            <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="save()">{{ t('action.save') }}</button>
          </div>
        </section>
      </div>
    </ng-container>
  `,
})
export default class AssignmentSetupComponent {
  protected orgContext = inject(OrgContextService);
  private assessments = inject(AssessmentService);
  private route = inject(ActivatedRoute);
  private transloco = inject(TranslocoService);

  protected courseId = this.route.snapshot.paramMap.get('id')!;
  private lessonId = this.route.snapshot.paramMap.get('lessonId')!;

  protected maxPoints = signal(10);
  protected dueLocal = signal('');
  protected acceptLate = signal(true);
  protected saving = signal(false);
  protected saved = signal(false);
  protected errors = signal<string[]>([]);

  constructor() {
    this.assessments.assignmentSettings(this.org, this.courseId, this.lessonId).subscribe(s => {
      this.maxPoints.set(s.maxPoints);
      this.dueLocal.set(toLocalInput(s.dueAtUtc));
      this.acceptLate.set(s.acceptLateSubmissions);
    });
  }

  protected save(): void {
    this.saving.set(true);
    this.saved.set(false);
    this.errors.set([]);
    this.assessments
      .saveAssignmentSettings(this.org, this.courseId, this.lessonId, {
        maxPoints: this.maxPoints(),
        dueAtUtc: fromLocalInput(this.dueLocal()),
        acceptLateSubmissions: this.acceptLate(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.saved.set(true);
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.errors.set(errorMessages(err, this.transloco.translate('error.generic')));
        },
      });
  }

  private get org(): string {
    return this.orgContext.requireActiveSlug();
  }
}
