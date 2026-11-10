import { inject, Pipe, PipeTransform } from '@angular/core';
import { I18nService } from '../transloco/i18n.service';
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

  // Western digits in both languages (matches the design); calendar chosen per organization.
  const gregorian = () => new Intl.DateTimeFormat(`${locale}-u-ca-gregory-nu-latn`, { ...parts, ...time }).format(date);
  const hijri = (withTime: boolean) =>
    new Intl.DateTimeFormat(`${locale}-u-ca-islamic-umalqura-nu-latn`, { ...parts, ...(withTime ? time : {}) }).format(date);

  switch (calendar) {
    case 'Hijri':
      return hijri(true);
    case 'Both':
      return `${gregorian()} · ${hijri(false)}`;
    default:
      return gregorian();
  }
}

/** Page headers: "الأحد 8 نوفمبر · 28 جمادى الأولى", following the organization's calendar. */
export function formatLongDay(day: string, calendar: CalendarDisplay = 'Gregorian', locale = 'en'): string {
  const date = new Date(`${day}T12:00:00Z`);
  const gregorian = new Intl.DateTimeFormat(`${locale}-u-ca-gregory-nu-latn`, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const hijri = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(`${locale}-u-ca-islamic-umalqura-nu-latn`, { ...options, day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date);

  switch (calendar) {
    case 'Hijri':
      return hijri({ weekday: 'long' });
    case 'Both':
      return `${gregorian.format(date)} · ${hijri({})}`;
    default:
      return gregorian.format(date);
  }
}

/**
 * List rows: today or tomorrow, the weekday within six days either way, otherwise day and month.
 * Lists show one calendar only, so "Both" reads as Gregorian here; the page header carries both.
 */
export function formatShortDay(
  value: string,
  calendar: CalendarDisplay = 'Gregorian',
  locale = 'en',
  timeZone?: string,
  words: { today: string; tomorrow: string } = { today: 'Today', tomorrow: 'Tomorrow' },
  now: Date = new Date()
): string {
  const isDayOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const day = isDayOnly ? value : todayIn(timeZone, new Date(value));
  const date = new Date(`${day}T12:00:00Z`);
  const distance = Math.round((date.getTime() - new Date(`${todayIn(timeZone, now)}T12:00:00Z`).getTime()) / 86_400_000);

  if (distance === 0) return words.today;
  if (distance === 1) return words.tomorrow;
  if (Math.abs(distance) <= 6) return new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { weekday: 'long', timeZone: 'UTC' }).format(date);
  const system = calendar === 'Hijri' ? 'islamic-umalqura' : 'gregory';
  return new Intl.DateTimeFormat(`${locale}-u-ca-${system}-nu-latn`, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date);
}

/** `{{ value | orgDate }}` / `{{ value | orgDate: 'datetime' }}` using the active organization's settings. */
@Pipe({ name: 'orgDate', pure: false })
export class OrgDatePipe implements PipeTransform {
  private orgContext = inject(OrgContextService);
  private i18n = inject(I18nService);

  transform(value: string | Date | null | undefined, style: OrgDateStyle = 'date', calendar?: CalendarDisplay): string {
    const org = this.orgContext.activeOrg();
    return formatOrgDate(value, calendar ?? org?.calendar ?? 'Gregorian', { style, timeZone: org?.timeZone, locale: this.i18n.lang() });
  }
}

/** Today in a time zone as yyyy-MM-dd (what attendance and other calendar-day APIs expect). */
export function todayIn(timeZone?: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** The current hour (0-23) in a time zone, for greetings. */
export function hourIn(timeZone?: string, now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now));
}
