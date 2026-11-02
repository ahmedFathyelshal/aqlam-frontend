import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { catchError, concat, defer, EMPTY, Observable, tap, toArray } from 'rxjs';

import { AttendanceMark, SchoolService } from './school.service';

export type PendingSheet = {
  org: string;
  classId: string;
  className: string;
  date: string;
  startTime: string | null;
  marks: AttendanceMark[];
  queuedAt: string;
};

const STORAGE_KEY = 'aqlam.attendance.outbox';

const sameSheet = (a: PendingSheet, b: PendingSheet) =>
  a.org === b.org && a.classId === b.classId && a.date === b.date && a.startTime === b.startTime;

/** The latest version of a sheet replaces an older queued one (same class, day and meeting). */
export function upsertPending(queue: PendingSheet[], sheet: PendingSheet): PendingSheet[] {
  return [...queue.filter(s => !sameSheet(s, sheet)), sheet];
}

/** Only connection problems are worth retrying; the server rejecting a sheet will not change on resend. */
export function isOfflineError(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 502);
}

/**
 * Attendance sheets taken without a connection (classrooms often have poor signal). They are kept on the
 * device and sent when the browser is back online; the server's upsert makes resending safe.
 */
@Injectable({ providedIn: 'root' })
export class AttendanceOutbox {
  private school = inject(SchoolService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly pending = signal<PendingSheet[]>(this.read());

  constructor() {
    if (this.isBrowser) window.addEventListener('online', () => this.flush().subscribe());
  }

  enqueue(sheet: PendingSheet): void {
    this.write(upsertPending(this.pending(), sheet));
  }

  /** Sends every queued sheet; sent or rejected sheets leave the queue, offline failures stay. */
  flush(): Observable<unknown> {
    const queue = this.pending();
    if (!queue.length || (this.isBrowser && !navigator.onLine)) return EMPTY;

    return concat(
      ...queue.map(sheet =>
        defer(() => this.school.saveAttendance(sheet.org, sheet.classId, sheet.date, sheet.startTime, sheet.marks)).pipe(
          tap(() => this.remove(sheet)),
          catchError((error: unknown) => {
            if (!isOfflineError(error)) this.remove(sheet);
            return EMPTY;
          })
        )
      )
    ).pipe(toArray());
  }

  /** Removes exactly this queued version (a newer edit queued meanwhile stays). */
  private remove(sheet: PendingSheet): void {
    this.write(this.pending().filter(s => !(sameSheet(s, sheet) && s.queuedAt === sheet.queuedAt)));
  }

  private read(): PendingSheet[] {
    if (!this.isBrowser) return [];
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as PendingSheet[];
    } catch {
      return [];
    }
  }

  private write(queue: PendingSheet[]): void {
    this.pending.set(queue);
    if (this.isBrowser) localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  }
}
