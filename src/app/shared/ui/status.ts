/**
 * One status → badge map so every staff screen agrees. Green = fine, warning = watch, danger = act,
 * blue = information or not yet due, neutral = no data. Gold never appears on staff screens.
 */
const BADGES: Record<string, string> = {
  // Attendance
  Present: 'badge-success',
  Absent: 'badge-danger',
  Late: 'badge-warning',
  Excused: 'badge-info',
  // Courses
  Published: 'badge-success',
  Scheduled: 'badge-info',
  Draft: 'badge-neutral',
  Archived: 'badge-neutral',
  Suspended: 'badge-danger',
  // Homework
  Submitted: 'badge-info',
  ReturnedForRevision: 'badge-warning',
  Graded: 'badge-success',
  // Memberships
  Pending: 'badge-warning',
  Active: 'badge-success',
  Left: 'badge-neutral',
  // Today's attendance of a class
  Taken: 'badge-success',
  Missing: 'badge-warning',
  NotToday: 'badge-neutral',
};

export function statusBadge(status: string | null | undefined): string {
  return 'badge ' + (BADGES[status ?? ''] ?? 'badge-neutral');
}
