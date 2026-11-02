import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AssessmentService, Question, QuizSettings } from '@/app/core/learning/assessment.service';
import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { ApiValidationError } from '@/app/core/utils/api-error.utils';

type Selected = { points: number; question: Question };

/** Settings and questions of one Quiz lesson; questions come from the organization's bank. */
@Component({
  selector: 'app-quiz-setup',
  imports: [MatButtonModule, MatIconModule, RouterLink],
  templateUrl: './quiz-setup.component.html',
})
export default class QuizSetupComponent {
  protected orgContext = inject(OrgContextService);
  private assessments = inject(AssessmentService);
  private snackBar = inject(MatSnackBar);
  private route = inject(ActivatedRoute);

  protected courseId = this.route.snapshot.paramMap.get('id')!;
  private lessonId = this.route.snapshot.paramMap.get('lessonId')!;

  protected settings = signal<Omit<QuizSettings, 'questions'>>({
    timeLimitMinutes: null, maxAttempts: null, passPercent: 60,
    shuffleQuestions: false, shuffleOptions: false, showAnswersAfterSubmit: true,
  });
  protected selected = signal<Selected[]>([]);
  protected bank = signal<Question[]>([]);
  protected search = signal('');
  protected errors = signal<string[]>([]);
  protected saving = signal(false);

  protected available = computed(() => {
    const chosen = new Set(this.selected().map(s => s.question.id));
    return this.bank().filter(q => !chosen.has(q.id));
  });
  protected totalPoints = computed(() => this.selected().reduce((sum, s) => sum + s.points, 0));

  constructor() {
    this.assessments.quiz(this.org, this.courseId, this.lessonId).subscribe(quiz => {
      const { questions, lessonId: _, ...settings } = quiz;
      this.settings.set(settings);
      this.selected.set(questions.map(q => ({ question: q.question, points: q.points })));
    });
    this.loadBank();
  }

  protected loadBank(): void {
    this.assessments.questions(this.org, this.search().trim() || undefined).subscribe(q => this.bank.set(q));
  }

  protected patch(changes: Partial<Omit<QuizSettings, 'questions'>>): void {
    this.settings.update(s => ({ ...s, ...changes }));
  }

  protected add(question: Question): void {
    this.selected.update(list => [...list, { question, points: question.points }]);
  }

  protected removeAt(index: number): void {
    this.selected.update(list => list.filter((_, i) => i !== index));
  }

  protected move(index: number, delta: -1 | 1): void {
    this.selected.update(list => {
      const target = index + delta;
      if (target < 0 || target >= list.length) return list;
      const copy = [...list];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  protected setPoints(index: number, points: number): void {
    this.selected.update(list => list.map((s, i) => (i === index ? { ...s, points } : s)));
  }

  protected save(): void {
    this.saving.set(true);
    this.errors.set([]);
    const body: QuizSettings = {
      ...this.settings(),
      questions: this.selected().map(s => ({ questionId: s.question.id, points: s.points })),
    };
    this.assessments.saveQuiz(this.org, this.courseId, this.lessonId, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackBar.open('Quiz saved.', 'Close', { duration: 3000 });
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.errors.set(err instanceof ApiValidationError ? err.errors : ['The quiz could not be saved.']);
      },
    });
  }

  /** Empty input means "no limit". */
  protected optionalNumber(value: string): number | null {
    return value.trim() === '' ? null : Math.max(1, Math.round(+value));
  }

  private get org(): string {
    return this.orgContext.requireActiveSlug();
  }
}
