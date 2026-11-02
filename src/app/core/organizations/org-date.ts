import { inject, Pipe, PipeTransform } from '@angular/core';
import { CalendarDisplay, OrgContextService } from './org-context.service';

export type OrgDateStyle = 'date' | 'datetime';

/**
 * Formats a date for an organization's calendar preference. Saudi users usually read the Umm al-Qura
 * Hijri date next to the Gregorian one ("Both"). Dates without a time (yyyy-MM-dd) are calendar days and
 * are never shifted by time zone.
 */
export function formatOrgDate(
  value: string | Date | null | undefined,
  calendar: CalendarDisplay = 'Gregorian',
  options: { style?: OrgDateStyle; locale?: string; timeZone?: string } = {}
): string {
  if (value === null || value === undefined || value === '') return '';

  const isDayOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = isDayOnly ? new Date(`${value}T12:00:00Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const locale = options.locale ?? 'en';
  const timeZone = isDayOnly ? 'UTC' : options.timeZone;
  const parts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric', timeZone };
  const time: Intl.DateTimeFormatOptions =
    options.style === 'datetime' && !isDayOnly ? { hour: '2-digit', minute: '2-digit' } : {};

  const gregorian = () => new Intl.DateTimeFormat(`${locale}-u-ca-gregory`, { ...parts, ...time }).format(date);
  const hijri = (withTime: boolean) =>
    new Intl.DateTimeFormat(`${locale}-u-ca-islamic-umalqura`, { ...parts, ...(withTime ? time : {}) }).format(date);

  switch (calendar) {
    case 'Hijri':
      return hijri(true);
    case 'Both':
      return `${gregorian()} · ${hijri(false)}`;
    default:
      return gregorian();
  }
}

/** `{{ value | orgDate }}` / `{{ value | orgDate: 'datetime' }}` using the active organization's settings. */
@Pipe({ name: 'orgDate', pure: false })
export class OrgDatePipe implements PipeTransform {
  private orgContext = inject(OrgContextService);

  transform(value: string | Date | null | undefined, style: OrgDateStyle = 'date', calendar?: CalendarDisplay): string {
    const org = this.orgContext.activeOrg();
    return formatOrgDate(value, calendar ?? org?.calendar ?? 'Gregorian', { style, timeZone: org?.timeZone });
  }
}

/** Today in a time zone as yyyy-MM-dd (what attendance and other calendar-day APIs expect). */
export function todayIn(timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
