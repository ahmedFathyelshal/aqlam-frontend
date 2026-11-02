import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';

import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { OrgDatePipe } from '@/app/core/organizations/org-date';
import { Announcement, AnnouncementAudience, AnnouncementScope, ClassSummary, NewAnnouncement, SchoolService } from '@/app/core/school/school.service';
import { LookupDto, LookupsService } from '@/app/core/services/lookups.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';

const AUDIENCES: { value: AnnouncementAudience; label: string }[] = [
  { value: 'Students', label: 'Students' },
  { value: 'Parents', label: 'Parents' },
  { value: 'Staff', label: 'Teachers & staff' },
];

/** Write an announcement to a class, a grade or the whole organization; delivered in-app (and by email). */
@Component({
  selector: 'app-announcements',
  imports: [MatButtonModule, MatIconModule, OrgDatePipe],
  template: `
    <div class="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 class="text-2xl font-bold">Announcements</h1>
        <p class="text-sm text-neutral-500">Delivered to the bell in the app; optionally by email.</p>
      </header>

      @let d = draft();
      <section class="space-y-4 rounded-2xl border bg-white p-6 dark:bg-neutral-800">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="text-sm font-medium">Send to</span>
            <select class="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-neutral-900" [value]="d.scope" (change)="patch({ scope: $any($event.target).value })">
              <option value="Class">A class / group</option>
              @if (canManage()) {
                <option value="Grade">A whole grade</option>
                <option value="Organization">Everyone in the organization</option>
              }
            </select>
          </label>
          @if (d.scope === 'Class') {
            <label class="block">
              <span class="text-sm font-medium">Class</span>
              <select class="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-neutral-900" [value]="d.classGroupId ?? ''" (change)="patch({ classGroupId: $any($event.target).value || null })">
                <option value="">Choose…</option>
                @for (c of classes(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
              </select>
            </label>
          }
          @if (d.scope === 'Grade') {
            <label class="block">
              <span class="text-sm font-medium">Grade</span>
              <select class="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-neutral-900" [value]="d.gradeId ?? ''" (change)="patch({ gradeId: +$any($event.target).value || null })">
                <option value="">Choose…</option>
                @for (g of gradesInUse(); track g) { <option [value]="g">{{ gradeName(g) }} ({{ classNamesOfGrade(g) }})</option> }
              </select>
            </label>
          }
        </div>

        <fieldset class="flex flex-wrap gap-4">
          <legend class="mb-1 text-sm font-medium">Who receives it</legend>
          @for (a of audiences; track a.value) {
            <label class="flex items-center gap-2">
              <input type="checkbox" [checked]="d.audience.includes(a.value)" (change)="toggleAudience(a.value, $any($event.target).checked)" /> {{ a.label }}
            </label>
          }
        </fieldset>

        <label class="block">
          <span class="text-sm font-medium">Title</span>
          <input class="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-neutral-900" maxlength="200" [value]="d.title" (input)="patch({ title: $any($event.target).value })" />
        </label>
        <label class="block">
          <span class="text-sm font-medium">Message</span>
          <textarea class="mt-1 min-h-28 w-full rounded-lg border px-3 py-2 dark:bg-neutral-900" maxlength="5000" [value]="d.body" (input)="patch({ body: $any($event.target).value })"></textarea>
        </label>
        <label class="flex items-center gap-2">
          <input type="checkbox" [checked]="d.sendEmail" (change)="patch({ sendEmail: $any($event.target).checked })" /> Also send by email (to those with an address)
        </label>

        @if (errors().length) { <p class="text-sm text-red-600">{{ errors().join(' • ') }}</p> }
        @if (sentTo() !== null) { <p class="text-sm text-green-700 dark:text-green-400">Sent to {{ sentTo() }} people.</p> }
        <div class="flex justify-end">
          <button matButton="filled" [disabled]="sending() || !canSend()" (click)="send()"><mat-icon svgIcon="send" /> Send</button>
        </div>
      </section>

      <section class="space-y-3">
        <h2 class="font-semibold">Sent</h2>
        @for (a of history(); track a.id) {
          <article class="rounded-2xl border bg-white p-4 dark:bg-neutral-800">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <h3 class="font-semibold">{{ a.title }}</h3>
              <span class="text-xs text-neutral-500">{{ a.publishedAtUtc | orgDate: 'datetime' }}</span>
            </div>
            <p class="mt-1 text-sm whitespace-pre-line">{{ a.body }}</p>
            <p class="mt-2 text-xs text-neutral-500">
              {{ a.className ?? (a.scope === 'Organization' ? 'Everyone' : a.scope) }} · {{ a.audience.join(', ') }} · {{ a.recipientCount }} recipients · {{ a.authorName }}
            </p>
          </article>
        } @empty {
          <p class="text-sm text-neutral-500">Nothing sent yet.</p>
        }
      </section>
    </div>
  `,
})
export default class AnnouncementsComponent {
  protected orgContext = inject(OrgContextService);
  private school = inject(SchoolService);
  private route = inject(ActivatedRoute);
  private lookups = inject(LookupsService);

  protected readonly audiences = AUDIENCES;
  protected canManage = computed(() => this.orgContext.can('classes.manage'));
  protected classes = signal<ClassSummary[]>([]);
  protected history = signal<Announcement[]>([]);
  private grades = signal<LookupDto[]>([]);
  protected draft = signal<NewAnnouncement>({
    title: '', body: '', scope: 'Class', gradeId: null,
    classGroupId: this.route.snapshot.queryParamMap.get('classId'), audience: ['Students', 'Parents'], sendEmail: false,
  });
  protected sending = signal(false);
  protected errors = signal<string[]>([]);
  protected sentTo = signal<number | null>(null);

  protected gradesInUse = computed(() => [...new Set(this.classes().map(c => c.gradeId).filter((g): g is number => g !== null))]);
  protected canSend = computed(() => {
    const d = this.draft();
    const target = d.scope === 'Organization' || (d.scope === 'Class' && !!d.classGroupId) || (d.scope === 'Grade' && !!d.gradeId);
    return target && d.audience.length > 0 && !!d.title.trim() && !!d.body.trim();
  });

  constructor() {
    // Managers can address any class; teachers only their own.
    this.school.classes(this.org, !this.canManage()).subscribe(c => this.classes.set(c));
    this.loadHistory();
    if (this.canManage()) this.lookups.getEducationGrades().subscribe(g => this.grades.set(g));
  }

  protected gradeName(gradeId: number): string {
    return this.grades().find(g => g.id === gradeId)?.nameEn ?? 'Grade';
  }

  protected classNamesOfGrade(gradeId: number): string {
    return this.classes().filter(c => c.gradeId === gradeId).map(c => c.name).join(', ');
  }

  protected patch(changes: Partial<NewAnnouncement>): void {
    this.draft.update(d => ({ ...d, ...changes }));
    this.sentTo.set(null);
  }

  protected toggleAudience(audience: AnnouncementAudience, checked: boolean): void {
    const current = this.draft().audience.filter(a => a !== audience);
    this.patch({ audience: checked ? [...current, audience] : current });
  }

  protected send(): void {
    this.sending.set(true);
    this.errors.set([]);
    const d = this.draft();
    const scope: AnnouncementScope = d.scope;
    this.school.publishAnnouncement(this.org, {
      ...d,
      title: d.title.trim(),
      body: d.body.trim(),
      classGroupId: scope === 'Class' ? d.classGroupId : null,
      gradeId: scope === 'Grade' ? d.gradeId : null,
    }).subscribe({
      next: sent => {
        this.sending.set(false);
        this.draft.update(x => ({ ...x, title: '', body: '' }));
        this.sentTo.set(sent.recipientCount);
        this.loadHistory();
      },
      error: (err: unknown) => {
        this.sending.set(false);
        this.errors.set(errorMessages(err, 'The announcement could not be sent.'));
      },
    });
  }

  private loadHistory(): void {
    this.school.announcements(this.org).subscribe(a => this.history.set(a));
  }

  private get org(): string {
    return this.orgContext.requireActiveSlug();
  }
}
