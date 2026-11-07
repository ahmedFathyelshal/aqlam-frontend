import { ChildOverview } from '@/app/core/school/family.service';

/** Thresholds behind the sentence a parent reads first. Product decisions: change them here and in the spec. */
export const SUMMARY_RULES = {
  absentDaysForFollowUp: 3,
  lateDaysForFollowUp: 5,
  goodGradePercent: 75,
  lowGradePercent: 60,
  /** "Most absences were recent" looks at this many calendar days back from the latest record. */
  recentWindowDays: 14,
};

export type GradeLevel = 'good' | 'mid' | 'low' | 'none';
export type AttendanceLevel = 'regular' | 'followUp' | 'none';

export type ChildSummary = {
  grades: GradeLevel;
  attendance: AttendanceLevel;
  needsFollowUp: boolean;
  days: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  mostAbsencesRecent: boolean;
};

const DAY_MS = 86_400_000;

/** Reads a child's overview into one judgement. Only facts in the data are used; no data means no verdict. */
export function summarizeChild(overview: Pick<ChildOverview, 'attendance' | 'grades'>): ChildSummary {
  const days = overview.attendance.days;
  const count = (status: string) => days.filter(d => d.status === status).length;
  const absent = count('Absent');
  const late = count('Late');

  const attendance: AttendanceLevel = !days.length ? 'none'
    : absent >= SUMMARY_RULES.absentDaysForFollowUp || late >= SUMMARY_RULES.lateDaysForFollowUp ? 'followUp'
    : 'regular';

  const marked = overview.grades.flatMap(g => (g.percent === null ? [] : [g.percent]));
  const average = marked.length ? marked.reduce((sum, p) => sum + p, 0) / marked.length : null;
  const grades: GradeLevel = average === null ? 'none'
    : average >= SUMMARY_RULES.goodGradePercent ? 'good'
    : average >= SUMMARY_RULES.lowGradePercent ? 'mid'
    : 'low';

  return {
    grades,
    attendance,
    needsFollowUp: attendance === 'followUp' || grades === 'low',
    days: days.length,
    present: count('Present'),
    absent,
    late,
    excused: count('Excused'),
    mostAbsencesRecent: absent >= 2 && isMostlyRecent(days),
  };
}

function isMostlyRecent(days: ChildOverview['attendance']['days']): boolean {
  const latest = new Date(days[days.length - 1].date).getTime();
  const absences = days.filter(d => d.status === 'Absent');
  const recent = absences.filter(d => latest - new Date(d.date).getTime() < SUMMARY_RULES.recentWindowDays * DAY_MS);
  return recent.length * 2 > absences.length;
}

/** Average of the marked results per course, for the grades card. */
export function courseAverages(grades: ChildOverview['grades']): Map<string, number> {
  const totals = new Map<string, { sum: number; count: number }>();
  for (const g of grades) {
    if (g.percent === null) continue;
    const total = totals.get(g.courseId) ?? { sum: 0, count: 0 };
    totals.set(g.courseId, { sum: total.sum + g.percent, count: total.count + 1 });
  }
  return new Map([...totals].map(([id, t]) => [id, Math.round(t.sum / t.count)]));
}

/** "3 أيام", "يومين", "11 يومًا" / "3 days": Arabic counted nouns change with the number. */
export function dayCount(n: number, lang: string): string {
  if (lang !== 'ar') return n === 1 ? '1 day' : `${n} days`;
  if (n === 1) return 'يوم واحد';
  if (n === 2) return 'يومين';
  return n <= 10 ? `${n} أيام` : `${n} يومًا`;
}
