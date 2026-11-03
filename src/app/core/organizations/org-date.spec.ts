import { describe, expect, it } from 'vitest';
import { formatOrgDate, todayIn } from './org-date';
import { grants } from './permissions';

describe('formatOrgDate', () => {
  it('shows Gregorian by default', () => {
    expect(formatOrgDate('2026-11-02')).toBe('Nov 2, 2026');
  });

  it('shows the Umm al-Qura Hijri date', () => {
    // 2 November 2026 = 22 Jumada I 1448 AH
    expect(formatOrgDate('2026-11-02', 'Hijri')).toMatch(/1448/);
  });

  it('shows both calendars side by side', () => {
    const both = formatOrgDate('2026-11-02', 'Both');
    expect(both.startsWith('Nov 2, 2026 · ')).toBe(true);
    expect(both).toMatch(/1448/);
  });

  it('never shifts a calendar day by time zone', () => {
    expect(formatOrgDate('2026-01-01', 'Gregorian', { timeZone: 'Pacific/Kiritimati' })).toBe('Jan 1, 2026');
  });

  it('returns an empty string for missing or invalid values', () => {
    expect(formatOrgDate(null)).toBe('');
    expect(formatOrgDate('not a date')).toBe('');
  });
});

describe('todayIn', () => {
  it('returns yyyy-MM-dd', () => {
    expect(todayIn('Asia/Riyadh')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('grants', () => {
  it('mirrors the backend matrix', () => {
    expect(grants(['Teacher'], 'attendance.take')).toBe(true);
    expect(grants(['Teacher'], 'classes.manage')).toBe(false);
    expect(grants(['Assistant'], 'announcements.send')).toBe(false);
    expect(grants(['Parent'], 'children.view')).toBe(true);
    expect(grants(['Student', 'Admin'], 'classes.manage')).toBe(true);
  });
});
