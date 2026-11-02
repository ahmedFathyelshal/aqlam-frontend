import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AssessmentService } from '@/app/core/learning/assessment.service';
import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { ApiValidationError } from '@/app/core/utils/api-error.utils';

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
  imports: [MatButtonModule, RouterLink],
  template: `
    <div class="mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <a class="text-sm text-neutral-500 hover:underline" [routerLink]="orgContext.path('courses', courseId, 'curriculum')">← Curriculum</a>
        <h1 class="text-2xl font-bold">Assignment setup</h1>
        <p class="text-sm text-neutral-500">Write the instructions in the lesson content. Students hand in text and links; you grade them in Grading.</p>
      </header>

      <section class="space-y-4 rounded-2xl border bg-white p-6 dark:bg-neutral-800">
        <label class="block">
          <span class="text-sm font-medium">Maximum points</span>
          <input type="number" min="1" class="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-neutral-900"
                 [value]="maxPoints()" (input)="maxPoints.set(+$any($event.target).value)" />
        </label>
        <label class="block">
          <span class="text-sm font-medium">Due date (optional)</span>
          <input type="datetime-local" class="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-neutral-900"
                 [value]="dueLocal()" (input)="dueLocal.set($any($event.target).value)" />
        </label>
        <label class="flex items-center gap-2">
          <input type="checkbox" [checked]="acceptLate()" (change)="acceptLate.set($any($event.target).checked)" />
          Accept late submissions (marked as late)
        </label>
        @if (errors().length) {
          <p class="text-sm text-red-600">{{ errors().join(' • ') }}</p>
        }
        <div class="flex justify-end">
          <button matButton="filled" [disabled]="saving()" (click)="save()">Save</button>
        </div>
      </section>
    </div>
  `,
})
export default class AssignmentSetupComponent {
  protected orgContext = inject(OrgContextService);
  private assessments = inject(AssessmentService);
  private snackBar = inject(MatSnackBar);
  private route = inject(ActivatedRoute);

  protected courseId = this.route.snapshot.paramMap.get('id')!;
  private lessonId = this.route.snapshot.paramMap.get('lessonId')!;

  protected maxPoints = signal(10);
  protected dueLocal = signal('');
  protected acceptLate = signal(true);
  protected saving = signal(false);
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
          this.snackBar.open('Assignment saved.', 'Close', { duration: 3000 });
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.errors.set(err instanceof ApiValidationError ? err.errors : ['The assignment could not be saved.']);
        },
      });
  }

  private get org(): string {
    return this.orgContext.requireActiveSlug();
  }
}
