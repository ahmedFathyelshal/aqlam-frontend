import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, OnDestroy, OnInit, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { Answer, AssessmentService, Attempt, AttemptQuestion, AttemptResult, QuizSummary } from '@/app/core/learning/assessment.service';

const AUTOSAVE_DELAY_MS = 2_000;

/** "mm:ss" (or "h:mm:ss") for the time left; never negative. */
export function formatRemaining(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mmss = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
}

/**
 * Student quiz inside the player: status → attempt (autosave, server deadline countdown) → result.
 * The server is the source of truth for time and grading; this view only mirrors it.
 */
@Component({
  selector: 'app-quiz-panel',
  imports: [DecimalPipe, MatIconModule, MatProgressSpinnerModule, TranslocoDirective],
  templateUrl: './quiz-panel.component.html',
})
export class QuizPanelComponent implements OnInit, OnDestroy {
  org = input.required<string>();
  lessonId = input.required<string>();
  preview = input(false);
  completed = output<void>();

  private assessments = inject(AssessmentService);
  private transloco = inject(TranslocoService);

  protected summary = signal<QuizSummary | null>(null);
  protected attempt = signal<Attempt | null>(null);
  protected result = signal<AttemptResult | null>(null);
  protected answers = signal<Record<string, Answer>>({});
  protected error = signal<string | null>(null);
  protected busy = signal(false);
  protected now = signal(Date.now());

  protected remaining = computed(() => {
    const deadline = this.attempt()?.deadlineUtc;
    return deadline ? new Date(deadline).getTime() - this.now() : null;
  });
  protected remainingText = computed(() => (this.remaining() === null ? '' : formatRemaining(this.remaining()!)));
  protected attemptsLeft = computed(() => {
    const s = this.summary();
    return s?.maxAttempts == null ? null : Math.max(0, s.maxAttempts - s.attemptsUsed);
  });

  private clock: ReturnType<typeof setInterval> | null = null;
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    if (this.preview()) return; // staff previews do not take quizzes (nothing is recorded)
    this.loadSummary();
    this.clock = setInterval(() => {
      this.now.set(Date.now());
      if (this.attempt() && this.remaining() !== null && this.remaining()! <= 0 && !this.busy()) {
        this.submit(); // time is up: hand in what we have (the server would auto-submit anyway)
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.clock) clearInterval(this.clock);
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
      this.saveNow();
    }
  }

  protected start(): void {
    this.busy.set(true);
    this.error.set(null);
    this.result.set(null);
    this.assessments.startAttempt(this.org(), this.lessonId()).subscribe({
      next: attempt => {
        this.busy.set(false);
        this.attempt.set(attempt);
        this.lastQuestions = attempt.questions; // kept for the result view after submitting
        // Restore answers saved earlier (resume after a refresh or a lost connection).
        this.answers.set(Object.fromEntries(attempt.questions.map(q => [q.questionId, {
          questionId: q.questionId, selectedOptionIds: q.selectedOptionIds, textAnswer: q.textAnswer,
        }])));
      },
      error: (err: unknown) => this.fail(err, this.transloco.translate('quiz.startFailed')),
    });
  }

  protected isSelected(question: AttemptQuestion, optionId: string): boolean {
    return this.answers()[question.questionId]?.selectedOptionIds?.includes(optionId) ?? false;
  }

  protected choose(question: AttemptQuestion, optionId: string): void {
    const current = this.answers()[question.questionId]?.selectedOptionIds ?? [];
    const selected = question.type === 'MultipleChoice'
      ? (current.includes(optionId) ? current.filter(id => id !== optionId) : [...current, optionId])
      : [optionId];
    this.setAnswer({ questionId: question.questionId, selectedOptionIds: selected });
  }

  protected write(question: AttemptQuestion, text: string): void {
    this.setAnswer({ questionId: question.questionId, textAnswer: text });
  }

  protected textOf(question: AttemptQuestion): string {
    return this.answers()[question.questionId]?.textAnswer ?? '';
  }

  protected answeredCount(): number {
    return Object.values(this.answers()).filter(a => (a.selectedOptionIds?.length ?? 0) > 0 || !!a.textAnswer?.trim()).length;
  }

  protected submit(): void {
    const attempt = this.attempt();
    if (!attempt) return;
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);

    this.busy.set(true);
    this.assessments.submitAttempt(this.org(), attempt.id, Object.values(this.answers())).subscribe({
      next: result => {
        this.busy.set(false);
        this.attempt.set(null);
        this.result.set(result);
        this.loadSummary();
        if (result.lessonCompleted) this.completed.emit();
      },
      error: (err: unknown) => {
        // 409: already submitted (e.g. by the server when time ran out) — show the latest status.
        if (err instanceof HttpErrorResponse && err.status === 409) {
          this.attempt.set(null);
          this.busy.set(false);
          this.loadSummary();
          return;
        }
        this.fail(err, this.transloco.translate('quiz.submitFailed'));
      },
    });
  }

  protected questionText(questionId: string): string {
    return this.lastQuestions.find(q => q.questionId === questionId)?.text ?? '';
  }

  protected optionText(questionId: string, optionId: string): string {
    return this.lastQuestions.find(q => q.questionId === questionId)?.options.find(o => o.id === optionId)?.text ?? '';
  }

  /** Accepted short answers, or the texts of the correct options. */
  protected correctAnswer(item: { questionId: string; acceptedAnswers: string[]; correctOptionIds: string[] }): string {
    return item.acceptedAnswers.length
      ? item.acceptedAnswers.join(' / ')
      : item.correctOptionIds.map(id => this.optionText(item.questionId, id)).join('، ');
  }

  private lastQuestions: AttemptQuestion[] = [];

  private setAnswer(answer: Answer): void {
    this.answers.update(all => ({ ...all, [answer.questionId]: { ...all[answer.questionId], ...answer } }));
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => this.saveNow(), AUTOSAVE_DELAY_MS);
  }

  private saveNow(): void {
    const attempt = this.attempt();
    this.autosaveTimer = null;
    if (!attempt) return;
    this.lastQuestions = attempt.questions;
    this.assessments.saveAnswers(this.org(), attempt.id, Object.values(this.answers())).subscribe({
      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 409) {
          this.attempt.set(null); // time ran out on the server: it submitted the saved answers
          this.error.set(this.transloco.translate('quiz.timeUp'));
          this.loadSummary();
        }
      },
    });
  }

  private loadSummary(): void {
    this.assessments.quizSummary(this.org(), this.lessonId()).subscribe({
      next: summary => this.summary.set(summary),
      error: (err: unknown) => this.fail(err, this.transloco.translate('quiz.unavailable')),
    });
  }

  private fail(err: unknown, fallback: string): void {
    this.busy.set(false);
    const message = err instanceof HttpErrorResponse ? (err.error as { errors?: string[] } | null)?.errors?.[0] : undefined;
    this.error.set(message ?? fallback);
  }
}
