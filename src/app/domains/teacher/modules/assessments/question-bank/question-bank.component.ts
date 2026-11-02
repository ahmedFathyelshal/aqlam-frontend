import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { AssessmentService, Question, QuestionInput, QuestionType } from '@/app/core/learning/assessment.service';
import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { ApiValidationError } from '@/app/core/utils/api-error.utils';

type Draft = QuestionInput & { id: string | null };

/** Fresh editor state for a question type (true/false gets its two fixed options). */
export function blankQuestion(type: QuestionType): Draft {
  const options =
    type === 'TrueFalse'
      ? [{ text: 'True', isCorrect: true }, { text: 'False', isCorrect: false }]
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
  imports: [MatButtonModule, MatIconModule, RouterLink],
  templateUrl: './question-bank.component.html',
})
export default class QuestionBankComponent {
  protected orgContext = inject(OrgContextService);
  private assessments = inject(AssessmentService);

  protected questions = signal<Question[]>([]);
  protected search = signal('');
  protected draft = signal<Draft | null>(null);
  protected errors = signal<string[]>([]);
  protected saving = signal(false);

  protected readonly types: { label: string; value: QuestionType }[] = [
    { value: 'SingleChoice', label: 'Single choice' },
    { value: 'MultipleChoice', label: 'Multiple choice' },
    { value: 'TrueFalse', label: 'True / false' },
    { value: 'ShortAnswer', label: 'Short answer' },
  ];

  constructor() {
    this.load();
  }

  protected load(): void {
    this.assessments.questions(this.org, this.search().trim() || undefined).subscribe(q => this.questions.set(q));
  }

  protected newQuestion(type: QuestionType = 'SingleChoice'): void {
    this.errors.set([]);
    this.draft.set(blankQuestion(type));
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
    this.draft.set({ ...blankQuestion(type), id: current.id, text: current.text, explanation: current.explanation, points: current.points });
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
        this.errors.set(err instanceof ApiValidationError ? err.errors : ['The question could not be saved.']);
      },
    });
  }

  protected remove(question: Question): void {
    if (!confirm('Delete this question? Quizzes will stop using it; past attempts keep their copy.')) return;
    this.assessments.deleteQuestion(this.org, question.id).subscribe(() => this.load());
  }

  protected typeLabel(type: QuestionType): string {
    return this.types.find(t => t.value === type)?.label ?? type;
  }

  private get org(): string {
    return this.orgContext.requireActiveSlug();
  }
}
