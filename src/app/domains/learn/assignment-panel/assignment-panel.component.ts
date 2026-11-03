import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { AssessmentService, StudentAssignment } from '@/app/core/learning/assessment.service';
import { formatOrgDate } from '@/app/core/organizations/org-date';
import { I18nService } from '@/app/core/transloco/i18n.service';
import { ApiValidationError } from '@/app/core/utils/api-error.utils';

/** Student assignment: due date, grade and feedback, and the hand-in form (text + https links). */
@Component({
  selector: 'app-assignment-panel',
  imports: [TranslocoDirective],
  templateUrl: './assignment-panel.component.html',
})
export class AssignmentPanelComponent implements OnInit {
  org = input.required<string>();
  lessonId = input.required<string>();
  preview = input(false);
  completed = output<void>();

  private assessments = inject(AssessmentService);
  private transloco = inject(TranslocoService);
  private i18n = inject(I18nService);

  protected assignment = signal<StudentAssignment | null>(null);
  protected text = signal('');
  protected links = signal('');
  protected busy = signal(false);
  protected error = signal<string | null>(null);

  ngOnInit(): void {
    if (!this.preview()) this.load();
  }

  protected submit(): void {
    const links = this.links().split(/\s+/).map(l => l.trim()).filter(Boolean);
    this.busy.set(true);
    this.error.set(null);
    this.assessments.submitAssignment(this.org(), this.lessonId(), this.text().trim() || null, links).subscribe({
      next: () => {
        this.busy.set(false);
        this.completed.emit();
        this.load();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        if (err instanceof ApiValidationError) {
          this.error.set(err.errors.join(' • '));
        } else {
          const message = err instanceof HttpErrorResponse ? (err.error as { errors?: string[] } | null)?.errors?.[0] : undefined;
          this.error.set(message ?? this.transloco.translate('error.generic'));
        }
      },
    });
  }

  protected date(value: string): string {
    return formatOrgDate(value, 'Gregorian', { style: 'datetime', locale: this.i18n.lang() });
  }

  private load(): void {
    this.assessments.assignment(this.org(), this.lessonId()).subscribe({
      next: assignment => {
        this.assignment.set(assignment);
        this.text.set(assignment.submission?.text ?? '');
        this.links.set(assignment.submission?.links.join('\n') ?? '');
      },
      error: () => this.error.set(this.transloco.translate('player.lessonUnavailable')),
    });
  }
}
