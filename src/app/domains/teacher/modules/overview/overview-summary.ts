/** Contracts of GET /api/orgs/{org}/overview and the rules that turn it into one sentence. */

export type TodayStatus = 'NotToday' | 'Pending' | 'Missing' | 'Taken';

export type OverviewDay = { date: string; ratePercent: number; marked: number };

export type OverviewClass = {
  id: string;
  name: string;
  kind: 'Section' | 'Group';
  students: number;
  homeroomTeacherName: string | null;
  today: TodayStatus;
  startsAt: string | null;
  attendancePercent: number | null;
  averagePercent: number | null;
  followUp: number;
};

export type OverviewFollowUp = {
  userId: string;
  fullName: string;
  classId: string | null;
  className: string | null;
  absent: number;
  late: number;
  averagePercent: number | null;
};

export type OverviewGrading = { courseId: string; courseTitle: string; waiting: number; oldestSubmittedAtUtc: string };

export type OrganizationOverview = {
  school: {
    name: string;
    logoUrl: string | null;
    type: 'School' | 'Center' | 'Personal';
    students: number;
    teachers: number;
    classes: number;
    rules: {
      followUpAbsentDays: number;
      followUpLateDays: number;
      goodGradePercent: number;
      lowGradePercent: number;
      /** "HH:mm:ss": a school's daily attendance is late after this time. */
      attendanceDueBy: string;
      groupAttendanceGraceMinutes: number;
    };
  };
  today: {
    date: string;
    isSchoolDay: boolean;
    expected: number;
    taken: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    ratePercent: number | null;
    usualRatePercent: number | null;
    lastSchoolDay: OverviewDay | null;
  };
  days: OverviewDay[];
  classes: OverviewClass[];
  followUpTotal: number;
  followUp: OverviewFollowUp[];
  grading: OverviewGrading[];
};

/** First match wins; each state names the one fact the owner should act on. */
export type HeadlineState = 'setup' | 'noSchool' | 'inProgress' | 'missing' | 'belowUsual' | 'grading' | 'onTrack';
export type Tone = 'neutral' | 'info' | 'good' | 'watch' | 'act';

export type Headline = {
  state: HeadlineState;
  tone: Tone;
  missing: number;
  pending: number;
  waitingOverWeek: number;
};

/** Today this many points under the usual rate reads as "below usual". */
export const BELOW_USUAL_POINTS = 5;
/** Homework waiting longer than this many days is a backlog. */
export const GRADING_BACKLOG_DAYS = 7;

const DAY_MS = 86_400_000;

export function daysWaiting(oldestUtc: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(oldestUtc).getTime()) / DAY_MS));
}

export function summarizeOverview(o: OrganizationOverview, now = Date.now()): Headline {
  const missing = o.classes.filter(c => c.today === 'Missing').length;
  const pending = o.classes.filter(c => c.today === 'Pending').length;
  const waitingOverWeek = o.grading
    .filter(g => daysWaiting(g.oldestSubmittedAtUtc, now) > GRADING_BACKLOG_DAYS)
    .reduce((sum, g) => sum + g.waiting, 0);
  const base = { missing, pending, waitingOverWeek };

  const { ratePercent: rate, usualRatePercent: usual } = o.today;
  const state: HeadlineState = !o.classes.length ? 'setup'
    : !o.today.expected && !o.today.taken ? 'noSchool'
    : missing ? 'missing'
    : pending ? 'inProgress'
    : rate !== null && usual !== null && rate <= usual - BELOW_USUAL_POINTS ? 'belowUsual'
    : waitingOverWeek ? 'grading'
    : 'onTrack';

  const tone: Record<HeadlineState, Tone> = {
    setup: 'neutral', noSchool: 'neutral', inProgress: 'info', missing: 'act', belowUsual: 'watch', grading: 'watch', onTrack: 'good',
  };
  return { state, tone: tone[state], ...base };
}

/** Classes that need a look first: not taken when due, then not yet due, then lowest attendance. */
export function sortClasses(classes: OverviewClass[]): OverviewClass[] {
  const order: Record<TodayStatus, number> = { Missing: 0, Pending: 1, Taken: 2, NotToday: 3 };
  return [...classes].sort((a, b) =>
    order[a.today] - order[b.today]
    || (a.attendancePercent ?? 101) - (b.attendancePercent ?? 101)
    || a.name.localeCompare(b.name, 'ar'));
}

type Forms = { one: string; two: string; few: string; many: string };

const AR: Record<'class' | 'group' | 'homework' | 'case' | 'day', Forms> = {
  class: { one: 'فصل واحد', two: 'فصلين', few: '{n} فصول', many: '{n} فصلًا' },
  group: { one: 'مجموعة واحدة', two: 'مجموعتين', few: '{n} مجموعات', many: '{n} مجموعة' },
  homework: { one: 'واجب واحد', two: 'واجبين', few: '{n} واجبات', many: '{n} واجبًا' },
  case: { one: 'حالة واحدة', two: 'حالتين', few: '{n} حالات', many: '{n} حالة' },
  day: { one: 'يوم واحد', two: 'يومين', few: '{n} أيام', many: '{n} يومًا' },
};
const EN: Record<keyof typeof AR, [string, string]> = {
  class: ['class', 'classes'], group: ['group', 'groups'], homework: ['assignment', 'assignments'], case: ['case', 'cases'], day: ['day', 'days'],
};

/** "3 فصول", "فصلين", "11 فصلًا" / "3 classes": Arabic counted nouns change with the number. */
export function countOf(noun: keyof typeof AR, n: number, lang: string): string {
  if (lang !== 'ar') return `${n} ${n === 1 ? EN[noun][0] : EN[noun][1]}`;
  const f = AR[noun];
  const form = n === 1 ? f.one : n === 2 ? f.two : n >= 3 && n <= 10 ? f.few : f.many;
  return form.replace('{n}', String(n));
}
