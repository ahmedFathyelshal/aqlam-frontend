import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { formatOrgDate, todayIn } from '@/app/core/organizations/org-date';
import { OrganizationSettings, SchoolService } from '@/app/core/school/school.service';
import { I18nService } from '@/app/core/transloco/i18n.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';
import { AqOrgMark } from '@/app/shared/ui/org-mark';
import { WEEK_DAYS } from '../classes/class-form';

const TIME_ZONES = ['Asia/Riyadh', 'Africa/Cairo', 'Asia/Dubai', 'Asia/Kuwait', 'Asia/Qatar', 'Asia/Bahrain', 'Asia/Amman', 'UTC'];

/** Organization profile and locale: name, branding, time zone, Hijri/Gregorian dates, first day of the week. */
@Component({
  selector: 'app-org-settings',
  imports: [TranslocoDirective, MatIconModule, AqOrgMark],
  template: `
    <ng-container *transloco="let t">
      <div class="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header class="page-header">
          <div>
            <h1 class="page-title">{{ t('settings.title') }}</h1>
            @if (settings(); as s) {
              <p class="page-subtitle"><span dir="ltr">{{ s.slug }}</span> · {{ t('orgType.' + s.type) }} · {{ s.countryCode }} · {{ s.currency }}</p>
            }
          </div>
        </header>

        @if (settings(); as s) {
          <div class="flex flex-col gap-6">
            <!-- Identity -->
            <section class="grid gap-3 lg:grid-cols-[16rem_1fr] lg:gap-8" aria-labelledby="set-identity">
              <div>
                <h2 id="set-identity" class="section-title">{{ t('settingsSec.identity') }}</h2>
                <p class="field-hint mt-1">{{ t('settingsSec.identityHint') }}</p>
              </div>
              <div class="card card-body flex flex-col gap-4">
                <label class="field">
                  <span class="field-label">{{ t('settings.name') }}</span>
                  <input class="input" maxlength="150" [value]="s.name" (input)="patch({ name: $any($event.target).value })" />
                </label>
                <div class="flex flex-wrap items-center gap-4">
                  <aq-org-mark [name]="s.name" [logoUrl]="s.logoUrl" [size]="64" />
                  <div class="flex min-w-56 flex-1 flex-col gap-1.5">
                    <span class="field-label">{{ t('settingsSec.logo') }}</span>
                    <div class="flex flex-wrap gap-2">
                      <label class="btn btn-outline cursor-pointer" [class.opacity-50]="uploading()">
                        <mat-icon svgIcon="upload" class="icon-size-5" />{{ uploading() ? t('settingsSec.uploading') : t('settingsSec.upload') }}
                        <input type="file" class="sr-only" accept="image/png,image/jpeg,image/webp" [disabled]="uploading()" (change)="uploadLogo($any($event.target))" />
                      </label>
                      @if (s.logoUrl) {
                        <button type="button" class="btn btn-ghost" [disabled]="uploading()" (click)="removeLogo()">{{ t('settingsSec.removeLogo') }}</button>
                      }
                    </div>
                    <span class="field-hint">{{ t('settingsSec.logoHint') }}</span>
                    @if (logoError()) { <span class="field-error" role="alert">{{ logoError() }}</span> }
                  </div>
                  <label class="field w-28">
                    <span class="field-label">{{ t('settings.color') }}</span>
                    <input type="color" class="input p-1" [value]="s.primaryColor ?? '#146C43'" (input)="patch({ primaryColor: $any($event.target).value })" />
                  </label>
                </div>
              </div>
            </section>

            <!-- Time and calendar -->
            <section class="grid gap-3 lg:grid-cols-[16rem_1fr] lg:gap-8" aria-labelledby="set-time">
              <div>
                <h2 id="set-time" class="section-title">{{ t('settingsSec.time') }}</h2>
                <p class="field-hint mt-1">{{ t('settingsSec.timeHint') }}</p>
              </div>
              <div class="card card-body flex flex-col gap-4">
                <div class="grid gap-4 sm:grid-cols-2">
                  <label class="field">
                    <span class="field-label">{{ t('settings.timeZone') }}</span>
                    <select class="select" dir="ltr" [value]="s.timeZone" (change)="patch({ timeZone: $any($event.target).value })">
                      @for (tz of timeZones(); track tz) { <option [value]="tz">{{ tz }}</option> }
                    </select>
                  </label>
                  <label class="field">
                    <span class="field-label">{{ t('settings.weekStart') }}</span>
                    <select class="select" [value]="s.weekStartDay" (change)="patch({ weekStartDay: $any($event.target).value })">
                      @for (d of days; track d) { <option [value]="d">{{ t('day.' + d) }}</option> }
                    </select>
                  </label>
                </div>
                <fieldset>
                  <legend class="field-label mb-2">{{ t('settings.dates') }}</legend>
                  <div class="segmented" role="radiogroup">
                    @for (c of calendars; track c) {
                      <button type="button" role="radio" class="segment" [attr.aria-checked]="s.calendar === c" [class.is-active]="s.calendar === c" (click)="patch({ calendar: c })">{{ t('settings.' + c) }}</button>
                    }
                  </div>
                  <p class="field-hint mt-2">{{ t('settings.preview', { date: preview() }) }}</p>
                </fieldset>
                @if (s.type === 'Center') {
                  <label class="check items-start rounded-ui border border-line bg-page p-3">
                    <input type="checkbox" class="mt-0.5" [checked]="s.teachersCreateCourses" (change)="patch({ teachersCreateCourses: $any($event.target).checked })" />
                    <span>
                      <span class="block font-bold">{{ t('settingsSec.teachersCreate') }}</span>
                      <span class="field-hint block">{{ t('settingsSec.teachersCreateHint') }}</span>
                    </span>
                  </label>
                }
                <div class="grid gap-4 sm:grid-cols-2">
                  <label class="field">
                    <span class="field-label">{{ t('settingsSec.dueBy') }}</span>
                    <input class="input" type="time" dir="ltr" min="05:00" max="23:00" step="300" [value]="s.attendanceDueBy.slice(0, 5)" (change)="patchDueBy($any($event.target).value)" />
                    <span class="field-hint">{{ t('settingsSec.dueByHint') }}</span>
                  </label>
                  <label class="field">
                    <span class="field-label">{{ t('settingsSec.grace') }}</span>
                    <input class="input" type="number" dir="ltr" inputmode="numeric" min="0" max="240" [value]="s.groupAttendanceGraceMinutes" (input)="patch({ groupAttendanceGraceMinutes: +$any($event.target).value })" />
                    <span class="field-hint">{{ t('settingsSec.graceHint') }}</span>
                  </label>
                </div>
              </div>
            </section>

            <!-- Grades and follow-up limits -->
            <section class="grid gap-3 lg:grid-cols-[16rem_1fr] lg:gap-8" aria-labelledby="set-grades">
              <div>
                <h2 id="set-grades" class="section-title">{{ t('settingsSec.grades') }}</h2>
                <p class="field-hint mt-1">{{ t('settings.limitsHint') }}</p>
              </div>
              <div class="card card-body flex flex-col gap-4">
                <label class="field">
                  <span class="field-label">{{ t('scale.title') }}</span>
                  <select class="select" (change)="patch({ gradingScale: $any($event.target).value })">
                    @for (scale of scales; track scale) { <option [value]="scale" [selected]="scale === s.gradingScale">{{ t('scale.' + scale) }}</option> }
                  </select>
                  <span class="field-hint">{{ t('scale.hint') }}</span>
                </label>
                <fieldset>
                  <legend class="field-label mb-2">{{ t('settings.limits') }}</legend>
                  <div class="grid gap-4 sm:grid-cols-2">
                    @for (limit of limits; track limit.field) {
                      <label class="field">
                        <span class="field-label font-semibold">{{ t('settings.' + limit.field) }}</span>
                        <input class="input" dir="ltr" type="number" inputmode="numeric" [min]="limit.min" [max]="limit.max" [value]="s[limit.field]" (input)="patchLimit(limit.field, $any($event.target).value)" />
                      </label>
                    }
                  </div>
                </fieldset>
              </div>
            </section>

            <!-- Contact for families -->
            <section class="grid gap-3 lg:grid-cols-[16rem_1fr] lg:gap-8" aria-labelledby="set-contact">
              <div>
                <h2 id="set-contact" class="section-title">{{ t('settings.contact') }}</h2>
                <p class="field-hint mt-1">{{ t('settings.contactHint') }}</p>
              </div>
              <div class="card card-body grid gap-4 sm:grid-cols-2">
                <label class="field">
                  <span class="field-label">{{ t('settings.contactPhone') }}</span>
                  <input class="input" dir="ltr" type="tel" inputmode="tel" maxlength="32" [value]="s.contactPhone ?? ''" (input)="patch({ contactPhone: $any($event.target).value || null })" />
                </label>
                <label class="field">
                  <span class="field-label">{{ t('settings.contactEmail') }}</span>
                  <input class="input" dir="ltr" type="email" inputmode="email" maxlength="256" [value]="s.contactEmail ?? ''" (input)="patch({ contactEmail: $any($event.target).value || null })" />
                </label>
              </div>
            </section>
          </div>

          <!-- Save bar stays in reach on long forms -->
          <div class="sticky bottom-14 z-10 -mx-4 mt-6 border-t border-line bg-page/95 px-4 py-3 backdrop-blur sm:bottom-0 sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-card lg:border lg:bg-white/95">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div class="flex-1" role="status">
                @if (errors().length) { <p class="text-sm text-danger-700">{{ errors().join(' ') }}</p> }
                @else if (saved()) { <p class="text-sm font-bold text-primary-700">{{ t('settings.saved') }}</p> }
              </div>
              <button type="button" class="btn btn-primary min-h-12 sm:min-w-40" [disabled]="saving()" (click)="save()">{{ t('action.save') }}</button>
            </div>
          </div>
        } @else {
          <div aria-hidden="true" class="flex flex-col gap-4">@for (i of [1, 2, 3]; track i) { <div class="skeleton h-40 !rounded-card"></div> }</div>
        }
      </div>
    </ng-container>
  `,
})
export default class SettingsComponent {
  private orgContext = inject(OrgContextService);
  private school = inject(SchoolService);
  private i18n = inject(I18nService);
  private transloco = inject(TranslocoService);

  protected readonly days = WEEK_DAYS;
  protected readonly calendars = ['Gregorian', 'Hijri', 'Both'] as const;
  protected readonly scales = ['Descriptive', 'Letters', 'Percent'] as const;
  protected readonly limits = [
    { field: 'followUpAbsentDays', min: 1, max: 20 },
    { field: 'followUpLateDays', min: 1, max: 20 },
    { field: 'goodGradePercent', min: 1, max: 100 },
    { field: 'lowGradePercent', min: 0, max: 100 },
    { field: 'achievementPercent', min: 1, max: 100 },
  ] as const;
  protected settings = signal<OrganizationSettings | null>(null);
  protected saving = signal(false);
  protected saved = signal(false);
  protected errors = signal<string[]>([]);
  protected uploading = signal(false);
  protected logoError = signal<string | null>(null);

  protected timeZones = computed(() => {
    const current = this.settings()?.timeZone;
    return current && !TIME_ZONES.includes(current) ? [current, ...TIME_ZONES] : TIME_ZONES;
  });
  protected preview = computed(() => {
    const s = this.settings();
    return s ? formatOrgDate(todayIn(s.timeZone), s.calendar, { locale: this.i18n.lang() }) : '';
  });

  constructor() {
    this.school.settings(this.org).subscribe(s => this.settings.set(s));
  }

  protected patch(changes: Partial<OrganizationSettings>): void {
    this.settings.update(s => (s ? { ...s, ...changes } : s));
    this.saved.set(false);
  }

  protected uploadLogo(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = ''; // the same file can be chosen again after an error
    if (!file) return;
    this.logoError.set(null);
    if (file.size > 256 * 1024) {
      this.logoError.set(this.transloco.translate('settingsSec.logoTooBig'));
      return;
    }
    this.uploading.set(true);
    this.school.uploadLogo(this.org, file).subscribe({
      next: result => this.logoSaved(result.logoUrl),
      error: (err: unknown) => {
        this.uploading.set(false);
        this.logoError.set(errorMessages(err, this.transloco.translate('error.generic')).join(' '));
      },
    });
  }

  protected removeLogo(): void {
    this.uploading.set(true);
    this.school.removeLogo(this.org).subscribe({
      next: () => this.logoSaved(null),
      error: (err: unknown) => {
        this.uploading.set(false);
        this.logoError.set(errorMessages(err, this.transloco.translate('error.generic')).join(' '));
      },
    });
  }

  /** The logo saves on its own; other unsaved changes on the page stay as they are. */
  private logoSaved(logoUrl: string | null): void {
    this.uploading.set(false);
    this.settings.update(s => (s ? { ...s, logoUrl } : s));
    this.orgContext.load().subscribe(); // the menu and portals show the new logo
  }

  protected patchDueBy(value: string): void {
    if (/^\d{2}:\d{2}$/.test(value)) this.patch({ attendanceDueBy: value + ':00' });
  }

  protected patchLimit(field: (typeof this.limits)[number]['field'], value: string): void {
    this.patch({ [field]: Number(value) });
  }

  protected save(): void {
    const s = this.settings();
    if (!s) return;
    this.saving.set(true);
    this.errors.set([]);
    const { slug, type, countryCode, currency, ...update } = s;
    this.school.saveSettings(this.org, update).subscribe({
      next: result => {
        this.saving.set(false);
        this.saved.set(true);
        this.settings.set(result);
        this.orgContext.load().subscribe(); // name and calendar are shown across the app
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.errors.set(errorMessages(err, this.transloco.translate('error.generic')));
      },
    });
  }

  private get org(): string {
    return this.orgContext.requireActiveSlug();
  }
}
