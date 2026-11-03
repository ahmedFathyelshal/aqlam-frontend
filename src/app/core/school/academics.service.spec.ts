import { describe, expect, it } from 'vitest';

import { AcademicTerm, AcademicYear, defaultTerm } from './academics.service';

const term = (id: string, startDate: string, endDate: string): AcademicTerm => ({ id, name: id, order: 1, startDate, endDate, reportCardsPublished: false });
const year = (id: string, isCurrent: boolean, terms: AcademicTerm[]): AcademicYear => ({ id, name: id, startDate: '2026-01-01', endDate: '2026-12-31', isCurrent, terms });

describe('defaultTerm', () => {
  const first = term('first', '2026-01-01', '2026-05-31');
  const second = term('second', '2026-06-01', '2026-12-31');
  const old = term('old', '2025-01-01', '2025-12-31');

  it('opens the term of today in the current year', () => {
    expect(defaultTerm([year('past', false, [old]), year('now', true, [first, second])], '2026-07-15')?.id).toBe('second');
  });

  it('falls back to the first term when today is outside every term', () => {
    expect(defaultTerm([year('now', true, [first, second])], '2027-02-01')?.id).toBe('first');
  });

  it('uses the latest year when none is marked current, and copes with nothing set up', () => {
    expect(defaultTerm([year('past', false, [old])], '2026-07-15')?.id).toBe('old');
    expect(defaultTerm([], '2026-07-15')).toBeNull();
    expect(defaultTerm([year('empty', true, [])], '2026-07-15')).toBeNull();
  });
});
