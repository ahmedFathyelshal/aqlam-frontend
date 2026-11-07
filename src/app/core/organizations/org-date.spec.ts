import { describe, expect, it } from 'vitest';
import { formatLongDay, formatOrgDate, formatShortDay, hourIn, todayIn } from './org-date';
import { grants } from './permissions';

describe('formatLongDay', () => {
  it('shows the weekday and follows the calendar setting', () => {
    expect(formatLongDay('2026-11-08', 'Gregorian', 'en')).toBe('Sunday, November 8');
    const both = formatLongDay('2026-11-08', 'Both', 'ar');
    expect(both).toContain('الأحد');
    expect(both).toContain('نوفمبر');
    expect(both).toContain('جمادى');
    expect(both).toMatch(/[0-9]/);
    expect(both).not.toMatch(/[٠-٩]/);
  });
});

describe('formatShortDay', () => {
  const now = new Date('2026-11-08T09:00:00Z'); // a Sunday
  const short = (value: string, calendar: 'Gregorian' | 'Hijri' | 'Both' = 'Gregorian') => formatShortDay(value, calendar, 'en', 'Asia/Riyadh', undefined, now);

  it('uses words close to today', () => {
    expect(short('2026-11-08')).toBe('Today');
    expect(short('2026-11-09')).toBe('Tomorrow');
    expect(short('2026-11-05')).toBe('Thursday');
    expect(short('2026-11-11')).toBe('Wednesday');
  });

  it('uses day and month further away, in one calendar only', () => {
    expect(short('2026-10-20')).toBe('October 20');
    expect(short('2026-10-20', 'Both')).toBe('October 20');
    expect(short('2026-10-20', 'Hijri')).not.toContain('October');
  });

  it('reads a moment as the day it is in the time zone', () => {
    expect(short('2026-11-08T22:00:00Z')).toBe('Tomorrow'); // already 1 am on the 9th in Riyadh
  });
});

describe('hourIn', () => {
  it('reads the hour in the time zone', () => {
    expect(hourIn('Asia/Riyadh', new Date('2026-11-08T09:30:00Z'))).toBe(12);
    expect(hourIn('UTC', new Date('2026-11-08T00:30:00Z'))).toBe(0);
  });
});

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
