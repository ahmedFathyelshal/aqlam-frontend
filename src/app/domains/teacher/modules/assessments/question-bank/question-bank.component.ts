import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { AssessmentService, Question, QuestionInput, QuestionType } from '@/app/core/learning/assessment.service';
import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { ApiValidationError } from '@/app/core/utils/api-error.utils';
import { ConfirmService } from '@/app/shared/ui/confirm.service';

type Draft = QuestionInput & { id: string | null };

/** Fresh editor state for a question type (true/false gets its two fixed options). */
export function blankQuestion(type: QuestionType, trueFalse: [string, string] = ['True', 'False']): Draft {
  const options =
    type === 'TrueFalse'
      ? [{ text: trueFalse[0], isCorrect: true }, { text: trueFalse[1], isCorrect: false }]
      : type === 'ShortAnswer'
        ? []
        : [{ text: '', isCorrect: true }, { text: '', isCorrect: false }];
  return {
    id: null, type, text: '', explanation: null, points: 1, difficulty: 2,
    curriculumId: null, gradeId: null, subjectId: null, options, acceptedAnswers: type === 'ShortAnswer' ? [''] : [],
  };
}

/** The organization's question bank: shared by all its teachers, reused across quizzes. */
@Component({
  selector: 'app-question-bank',
  imports: [MatIconModule, TranslocoDirective],
  templateUrl: './question-bank.component.html',
})
export default class QuestionBankComponent {
  private confirmer = inject(ConfirmService);
  protected orgContext = inject(OrgContextService);
  private assessments = inject(AssessmentService);
  private transloco = inject(TranslocoService);

  protected questions = signal<Question[]>([]);
  protected search = signal('');
  protected draft = signal<Draft | null>(null);
  protected errors = signal<string[]>([]);
  protected saving = signal(false);

  protected readonly types: QuestionType[] = ['SingleChoice', 'MultipleChoice', 'TrueFalse', 'ShortAnswer'];

  constructor() {
    this.load();
  }

  protected load(): void {
    this.assessments.questions(this.org, this.search().trim() || undefined).subscribe(q => this.questions.set(q));
  }

  protected newQuestion(type: QuestionType = 'SingleChoice'): void {
    this.errors.set([]);
    this.draft.set(blankQuestion(type, this.trueFalse()));
  }

  protected edit(question: Question): void {
    this.errors.set([]);
    this.draft.set({
      ...question,
      options: question.options.map(o => ({ ...o })),
      acceptedAnswers: [...question.acceptedAnswers],
    });
  }

  protected changeType(type: QuestionType): void {
    const current = this.draft();
    if (!current) return;
    this.draft.set({ ...blankQuestion(type, this.trueFalse()), id: current.id, text: current.text, explanation: current.explanation, points: current.points });
  }

  protected patch(changes: Partial<Draft>): void {
    this.draft.update(d => (d ? { ...d, ...changes } : d));
  }

  protected setOptionText(index: number, text: string): void {
    this.draft.update(d => (d ? { ...d, options: d.options.map((o, i) => (i === index ? { ...o, text } : o)) } : d));
  }

  /** Single choice and true/false allow exactly one correct option; multiple choice toggles. */
  protected toggleCorrect(index: number): void {
    this.draft.update(d => {
      if (!d) return d;
      const single = d.type !== 'MultipleChoice';
      return { ...d, options: d.options.map((o, i) => ({ ...o, isCorrect: single ? i === index : i === index ? !o.isCorrect : o.isCorrect })) };
    });
  }

  protected addOption(): void {
    this.draft.update(d => (d ? { ...d, options: [...d.options, { text: '', isCorrect: false }] } : d));
  }

  protected removeOption(index: number): void {
    this.draft.update(d => (d ? { ...d, options: d.options.filter((_, i) => i !== index) } : d));
  }

  protected setAccepted(index: number, value: string): void {
    this.draft.update(d => (d ? { ...d, acceptedAnswers: d.acceptedAnswers.map((a, i) => (i === index ? value : a)) } : d));
  }

  protected addAccepted(): void {
    this.draft.update(d => (d ? { ...d, acceptedAnswers: [...d.acceptedAnswers, ''] } : d));
  }

  protected save(): void {
    const draft = this.draft();
    if (!draft) return;
    const { id, ...input } = draft;
    const body: QuestionInput = { ...input, acceptedAnswers: input.acceptedAnswers.map(a => a.trim()).filter(Boolean) };

    this.saving.set(true);
    const request = id ? this.assessments.updateQuestion(this.org, id, body) : this.assessments.createQuestion(this.org, body);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.draft.set(null);
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.errors.set(err instanceof ApiValidationError ? err.errors : [this.transloco.translate('qb.saveFailed')]);
      },
    });
  }

  protected async remove(question: Question): Promise<void> {
    if (!(await this.confirmer.confirm({ title: this.transloco.translate('qb.confirmDelete'), confirmText: this.transloco.translate('action.delete'), cancelText: this.transloco.translate('action.cancel'), tone: 'danger' }))) return;
    this.assessments.deleteQuestion(this.org, question.id).subscribe(() => this.load());
  }

  private trueFalse(): [string, string] {
    return [this.transloco.translate('qb.true'), this.transloco.translate('qb.false')];
  }

  private get org(): string {
    return this.orgContext.requireActiveSlug();
  }
}
