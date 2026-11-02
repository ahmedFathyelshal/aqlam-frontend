import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { formatOrgDate, todayIn } from '@/app/core/organizations/org-date';
import { OrganizationSettings, SchoolService } from '@/app/core/school/school.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';
import { WEEK_DAYS } from '../classes/class-form';

const TIME_ZONES = ['Asia/Riyadh', 'Africa/Cairo', 'Asia/Dubai', 'Asia/Kuwait', 'Asia/Qatar', 'Asia/Bahrain', 'Asia/Amman', 'UTC'];

/** Organization profile and locale: name, branding, time zone, Hijri/Gregorian dates, first day of the week. */
@Component({
  selector: 'app-org-settings',
  imports: [MatButtonModule],
  template: `
    <div class="mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <h1 class="text-2xl font-bold">Settings</h1>
        @if (settings(); as s) {
          <p class="text-sm text-neutral-500"><span dir="ltr">{{ s.slug }}</span> · {{ s.type }} · {{ s.countryCode }} · {{ s.currency }}</p>
        }
      </header>

      @if (settings(); as s) {
        <section class="space-y-4 rounded-2xl border bg-white p-6 dark:bg-neutral-800">
          <label class="block">
            <span class="text-sm font-medium">Name</span>
            <input class="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-neutral-900" maxlength="150" [value]="s.name" (input)="patch({ name: $any($event.target).value })" />
          </label>
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="text-sm font-medium">Time zone</span>
              <select class="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-neutral-900" [value]="s.timeZone" (change)="patch({ timeZone: $any($event.target).value })">
                @for (tz of timeZones(); track tz) { <option [value]="tz">{{ tz }}</option> }
              </select>
            </label>
            <label class="block">
              <span class="text-sm font-medium">Week starts on</span>
              <select class="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-neutral-900" [value]="s.weekStartDay" (change)="patch({ weekStartDay: $any($event.target).value })">
                @for (d of days; track d) { <option [value]="d">{{ d }}</option> }
              </select>
            </label>
          </div>
          <fieldset>
            <legend class="text-sm font-medium">Dates</legend>
            <div class="mt-1 flex flex-wrap gap-4">
              @for (c of calendars; track c) {
                <label class="flex items-center gap-2">
                  <input type="radio" name="calendar" [checked]="s.calendar === c" (change)="patch({ calendar: c })" /> {{ c === 'Both' ? 'Gregorian + Hijri' : c }}
                </label>
              }
            </div>
            <p class="mt-1 text-sm text-neutral-500">Today shows as: {{ preview() }}</p>
          </fieldset>
          <div class="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <label class="block">
              <span class="text-sm font-medium">Logo URL (https)</span>
              <input class="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-neutral-900" dir="ltr" [value]="s.logoUrl ?? ''" (input)="patch({ logoUrl: $any($event.target).value || null })" />
            </label>
            <label class="block">
              <span class="text-sm font-medium">Brand color</span>
              <input type="color" class="mt-1 h-10 w-full rounded-lg border dark:bg-neutral-900" [value]="s.primaryColor ?? '#1E6FD9'" (input)="patch({ primaryColor: $any($event.target).value })" />
            </label>
          </div>

          @if (errors().length) { <p class="text-sm text-red-600">{{ errors().join(' • ') }}</p> }
          @if (saved()) { <p class="text-sm text-green-700 dark:text-green-400">Saved.</p> }
          <div class="flex justify-end">
            <button matButton="filled" [disabled]="saving()" (click)="save()">Save</button>
          </div>
        </section>
      }
    </div>
  `,
})
export default class SettingsComponent {
  private orgContext = inject(OrgContextService);
  private school = inject(SchoolService);

  protected readonly days = WEEK_DAYS;
  protected readonly calendars = ['Gregorian', 'Hijri', 'Both'] as const;
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
    return s ? formatOrgDate(todayIn(s.timeZone), s.calendar) : '';
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
        this.errors.set(errorMessages(err, 'The settings could not be saved.'));
      },
    });
  }

  private get org(): string {
    return this.orgContext.requireActiveSlug();
  }
}
