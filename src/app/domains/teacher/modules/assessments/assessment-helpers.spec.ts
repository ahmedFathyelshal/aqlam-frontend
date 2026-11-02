import { fromLocalInput, toLocalInput } from './assignment-setup/assignment-setup.component';
import { blankQuestion } from './question-bank/question-bank.component';

describe('blankQuestion', () => {
  it('gives true/false its two fixed options with one correct', () => {
    const q = blankQuestion('TrueFalse');
    expect(q.options.map(o => o.text)).toEqual(['True', 'False']);
    expect(q.options.filter(o => o.isCorrect)).toHaveLength(1);
  });

  it('gives short answers an accepted-answer slot and no options', () => {
    const q = blankQuestion('ShortAnswer');
    expect(q.options).toEqual([]);
    expect(q.acceptedAnswers).toEqual(['']);
  });

  it('starts choice questions with two options', () => {
    expect(blankQuestion('MultipleChoice').options).toHaveLength(2);
  });
});

describe('datetime-local conversion', () => {
  it('round-trips a UTC instant through the local input format', () => {
    const iso = '2026-12-01T10:30:00.000Z';
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
  });

  it('treats empty values as no due date', () => {
    expect(toLocalInput(null)).toBe('');
    expect(fromLocalInput('')).toBeNull();
  });
});
