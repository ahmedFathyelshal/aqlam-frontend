import { formatRemaining } from './quiz-panel.component';

describe('formatRemaining', () => {
  it('formats minutes and seconds', () => {
    expect(formatRemaining(65_000)).toBe('01:05');
    expect(formatRemaining(9_999)).toBe('00:09');
  });

  it('adds hours for long quizzes', () => {
    expect(formatRemaining(3_725_000)).toBe('1:02:05');
  });

  it('never shows negative time', () => {
    expect(formatRemaining(-5_000)).toBe('00:00');
  });
});
