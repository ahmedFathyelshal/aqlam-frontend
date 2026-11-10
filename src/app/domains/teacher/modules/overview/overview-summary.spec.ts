import { countOf, daysWaiting, OrganizationOverview, OverviewClass, sortClasses, summarizeOverview } from './overview-summary';

const NOW = Date.parse('2026-11-10T08:00:00Z');

function cls(name: string, today: OverviewClass['today'], attendancePercent: number | null = 95): OverviewClass {
  return { id: name, name, kind: 'Section', students: 20, homeroomTeacherName: null, today, startsAt: null, attendancePercent, averagePercent: null, followUp: 0 };
}

function overview(patch: Partial<OrganizationOverview['today']> = {}, classes = [cls('7-A', 'Taken')], grading: OrganizationOverview['grading'] = []): OrganizationOverview {
  return {
    school: { name: 'S', logoUrl: null, type: 'School', students: 40, teachers: 4, classes: classes.length, rules: { followUpAbsentDays: 3, followUpLateDays: 5, goodGradePercent: 75, lowGradePercent: 60, attendanceDueBy: '10:00:00', groupAttendanceGraceMinutes: 30 } },
    today: { date: '2026-11-10', isSchoolDay: true, expected: classes.length, taken: 1, present: 19, absent: 1, late: 0, excused: 0, ratePercent: 95, usualRatePercent: 94, lastSchoolDay: null, ...patch },
    days: [], classes, followUpTotal: 0, followUp: [], grading,
  };
}

describe('summarizeOverview', () => {
  it('asks for classes first in a new school', () => {
    expect(summarizeOverview(overview({}, []), NOW).state).toBe('setup');
  });

  it('says there is no school when nothing is expected or taken', () => {
    expect(summarizeOverview(overview({ expected: 0, taken: 0 }, [cls('7-A', 'NotToday')]), NOW).state).toBe('noSchool');
  });

  it('puts missing attendance ahead of classes that are not due yet', () => {
    const h = summarizeOverview(overview({ taken: 0 }, [cls('7-A', 'Missing'), cls('7-B', 'Pending'), cls('7-C', 'Missing')]), NOW);
    expect(h).toMatchObject({ state: 'missing', tone: 'act', missing: 2, pending: 1 });
  });

  it('keeps early morning neutral while attendance is still coming in', () => {
    expect(summarizeOverview(overview({ taken: 1 }, [cls('7-A', 'Taken'), cls('7-B', 'Pending')]), NOW)).toMatchObject({ state: 'inProgress', tone: 'info' });
  });

  it('flags a day five points or more below the usual rate', () => {
    expect(summarizeOverview(overview({ ratePercent: 86, usualRatePercent: 91 }), NOW).state).toBe('belowUsual');
    expect(summarizeOverview(overview({ ratePercent: 87, usualRatePercent: 91 }), NOW).state).toBe('onTrack');
  });

  it('counts only homework that has waited more than a week', () => {
    const grading = [
      { courseId: 'a', courseTitle: 'A', waiting: 4, oldestSubmittedAtUtc: '2026-11-01T08:00:00Z' },
      { courseId: 'b', courseTitle: 'B', waiting: 9, oldestSubmittedAtUtc: '2026-11-08T08:00:00Z' },
    ];
    expect(summarizeOverview(overview({}, undefined, grading), NOW)).toMatchObject({ state: 'grading', waitingOverWeek: 4 });
  });
});

describe('overview helpers', () => {
  it('sorts classes that need a look first', () => {
    const sorted = sortClasses([cls('A', 'Taken', 97), cls('B', 'NotToday'), cls('C', 'Taken', 80), cls('D', 'Missing'), cls('E', 'Pending')]);
    expect(sorted.map(c => c.name)).toEqual(['D', 'E', 'C', 'A', 'B']);
  });

  it('uses Arabic counted nouns', () => {
    expect(countOf('class', 1, 'ar')).toBe('فصل واحد');
    expect(countOf('class', 2, 'ar')).toBe('فصلين');
    expect(countOf('class', 3, 'ar')).toBe('3 فصول');
    expect(countOf('class', 12, 'ar')).toBe('12 فصلًا');
    expect(countOf('group', 2, 'en')).toBe('2 groups');
  });

  it('counts whole days waited', () => {
    expect(daysWaiting('2026-11-03T09:00:00Z', NOW)).toBe(6);
  });
});
