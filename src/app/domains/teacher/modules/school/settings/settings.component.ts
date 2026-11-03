import { Component, computed, inject, signal } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { formatOrgDate, todayIn } from '@/app/core/organizations/org-date';
import { OrganizationSettings, SchoolService } from '@/app/core/school/school.service';
import { I18nService } from '@/app/core/transloco/i18n.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';
import { WEEK_DAYS } from '../classes/class-form';

const TIME_ZONES = ['Asia/Riyadh', 'Africa/Cairo', 'Asia/Dubai', 'Asia/Kuwait', 'Asia/Qatar', 'Asia/Bahrain', 'Asia/Amman', 'UTC'];

/** Organization profile and locale: name, branding, time zone, Hijri/Gregorian dates, first day of the week. */
@Component({
  selector: 'app-org-settings',
  imports: [TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <div class="page-narrow">
        <header class="page-header">
          <div>
            <h1 class="page-title">{{ t('settings.title') }}</h1>
            @if (settings(); as s) {
              <p class="page-subtitle"><span dir="ltr">{{ s.slug }}</span> · {{ t('orgType.' + s.type) }} · {{ s.countryCode }} · {{ s.currency }}</p>
            }
          </div>
        </header>

        @if (settings(); as s) {
          <section class="card card-body flex flex-col gap-5">
            <label class="field">
              <span class="field-label">{{ t('settings.name') }}</span>
              <input class="input" maxlength="150" [value]="s.name" (input)="patch({ name: $any($event.target).value })" />
            </label>
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
            <label class="field">
              <span class="field-label">{{ t('scale.title') }}</span>
              <select class="select" (change)="patch({ gradingScale: $any($event.target).value })">
                @for (scale of scales; track scale) { <option [value]="scale" [selected]="scale === s.gradingScale">{{ t('scale.' + scale) }}</option> }
              </select>
              <span class="field-hint">{{ t('scale.hint') }}</span>
            </label>
            <div class="grid gap-4 sm:grid-cols-[1fr_9rem]">
              <label class="field">
                <span class="field-label">{{ t('settings.logo') }}</span>
                <input class="input" dir="ltr" inputmode="url" [value]="s.logoUrl ?? ''" (input)="patch({ logoUrl: $any($event.target).value || null })" />
              </label>
              <label class="field">
                <span class="field-label">{{ t('settings.color') }}</span>
                <input type="color" class="input p-1" [value]="s.primaryColor ?? '#146C43'" (input)="patch({ primaryColor: $any($event.target).value })" />
              </label>
            </div>

            @if (errors().length) { <div class="alert alert-danger" role="alert">{{ errors().join(' ') }}</div> }
            @if (saved()) { <div class="alert alert-success" role="status">{{ t('settings.saved') }}</div> }
            <button type="button" class="btn btn-primary self-stretch sm:self-end" [disabled]="saving()" (click)="save()">{{ t('action.save') }}</button>
          </section>
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
  protected settings = signal<OrganizationSettings | null>(null);
  protected saving = signal(false);
  protected saved = signal(false);
  protected errors = signal<string[]>([]);

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
