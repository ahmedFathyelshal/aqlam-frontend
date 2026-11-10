import { describe, expect, it } from 'vitest';
import { ChildOverview } from '@/app/core/school/family.service';
import { courseAverages, dayCount, summarizeChild } from './child-summary';

type Day = ChildOverview['attendance']['days'][number];

const RULES = { followUpAbsentDays: 3, followUpLateDays: 5, goodGradePercent: 75, lowGradePercent: 60 };

/** One record per day from 2026-10-01, in the order given. */
function days(pattern: string): Day[] {
  const names: Record<string, string> = { P: 'Present', A: 'Absent', L: 'Late', E: 'Excused' };
  return pattern.split('').map((c, i) => ({ date: new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10), status: names[c] }));
}

function grade(percent: number | null, courseId = 'c1'): ChildOverview['grades'][number] {
  return { kind: 'Quiz', courseId, lessonTitle: 'x', score: null, maxScore: 100, percent, status: 'Passed', atUtc: '2026-10-01T10:00:00Z' };
}

function overview(pattern: string, grades: ChildOverview['grades'] = []): Pick<ChildOverview, 'attendance' | 'grades'> {
  return { attendance: { present: 0, absent: 0, late: 0, excused: 0, recent: [], days: days(pattern) }, grades };
}

describe('summarizeChild', () => {
  it('gives no verdict without data', () => {
    const s = summarizeChild(overview(''), RULES);
    expect([s.attendance, s.grades, s.needsFollowUp]).toEqual(['none', 'none', false]);
  });

  it('reports good grades with absence that needs follow-up (the approved example)', () => {
    const s = summarizeChild(overview('PPPPPPLPPPPPAPPLAPAP', [grade(88), grade(83)]), RULES);
    expect(s).toMatchObject({ grades: 'good', attendance: 'followUp', needsFollowUp: true, days: 20, present: 15, absent: 3, late: 2 });
  });

  it('does not flag two absences or an excused absence', () => {
    expect(summarizeChild(overview('PPAPA'), RULES).attendance).toBe('regular');
    expect(summarizeChild(overview('EEEEEE'), RULES).attendance).toBe('regular');
  });

  it('flags repeated lateness', () => {
    expect(summarizeChild(overview('LLLLLP'), RULES).attendance).toBe('followUp');
  });

  it('grades by average at the thresholds, ignoring unmarked work', () => {
    expect(summarizeChild(overview('P', [grade(75)]), RULES).grades).toBe('good');
    expect(summarizeChild(overview('P', [grade(74.9)]), RULES).grades).toBe('mid');
    expect(summarizeChild(overview('P', [grade(60)]), RULES).grades).toBe('mid');
    const low = summarizeChild(overview('P', [grade(59), grade(null)]), RULES);
    expect([low.grades, low.needsFollowUp]).toEqual(['low', true]);
  });

  it('follows the limits the school set', () => {
    const strict = { followUpAbsentDays: 1, followUpLateDays: 1, goodGradePercent: 90, lowGradePercent: 80 };
    expect(summarizeChild(overview('PPA'), strict).attendance).toBe('followUp');
    expect(summarizeChild(overview('PPL'), strict).attendance).toBe('followUp');
    expect(summarizeChild(overview('P', [grade(85)]), strict).grades).toBe('mid');
    expect(summarizeChild(overview('P', [grade(79)]), strict).grades).toBe('low');
  });

  it('says absences are recent only when most of them are', () => {
    expect(summarizeChild(overview('PPPPPPPPPPPPPPPPAPPA'), RULES).mostAbsencesRecent).toBe(true);
    expect(summarizeChild(overview('AAPPPPPPPPPPPPPPPPPA'), RULES).mostAbsencesRecent).toBe(false);
    expect(summarizeChild(overview('PPPPPPPPPPPPPPPPPPPA'), RULES).mostAbsencesRecent).toBe(false); // one day is no trend
  });
});

describe('courseAverages', () => {
  it('averages per course and skips unmarked work', () => {
    const averages = courseAverages([grade(80), grade(91), grade(null), grade(50, 'c2'), grade(null, 'c3')]);
    expect(averages.get('c1')).toBe(86);
    expect(averages.get('c2')).toBe(50);
    expect(averages.has('c3')).toBe(false);
  });
});

describe('dayCount', () => {
  it('follows Arabic counting rules', () => {
    expect([1, 2, 3, 10, 11, 20].map(n => dayCount(n, 'ar'))).toEqual(['يوم واحد', 'يومين', '3 أيام', '10 أيام', '11 يومًا', '20 يومًا']);
  });

  it('pluralizes English', () => {
    expect([dayCount(1, 'en'), dayCount(20, 'en')]).toEqual(['1 day', '20 days']);
  });
});
