import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { isOfflineError, PendingSheet, upsertPending } from './attendance-outbox';

const sheet = (overrides: Partial<PendingSheet> = {}): PendingSheet => ({
  org: 'rowad',
  classId: 'c1',
  className: '7-A',
  date: '2026-11-02',
  startTime: null,
  marks: [{ userId: 'u1', status: 'Present', note: null }],
  queuedAt: '2026-11-02T07:00:00Z',
  ...overrides,
});

describe('upsertPending', () => {
  it('keeps one entry per class, day and meeting, the newest winning', () => {
    const newer = sheet({ marks: [{ userId: 'u1', status: 'Absent', note: null }], queuedAt: '2026-11-02T07:05:00Z' });
    const queue = upsertPending([sheet()], newer);
    expect(queue).toEqual([newer]);
  });

  it('keeps different meetings of the same day apart', () => {
    const queue = upsertPending([sheet({ startTime: '09:00' })], sheet({ startTime: '17:00' }));
    expect(queue.length).toBe(2);
  });
});

describe('isOfflineError', () => {
  it('retries connection problems only', () => {
    expect(isOfflineError(new HttpErrorResponse({ status: 0 }))).toBe(true);
    expect(isOfflineError(new HttpErrorResponse({ status: 503 }))).toBe(true);
    expect(isOfflineError(new HttpErrorResponse({ status: 400 }))).toBe(false);
    expect(isOfflineError(new Error('validation'))).toBe(false);
  });
});
