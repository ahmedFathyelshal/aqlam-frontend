import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { OrgShortDayPipe } from '@/app/core/organizations/org-date';
import { Announcement, AnnouncementAudience, ClassSummary, NewAnnouncement, SchoolService } from '@/app/core/school/school.service';
import { LookupDto, LookupsService } from '@/app/core/services/lookups.service';
import { I18nService } from '@/app/core/transloco/i18n.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';

const AUDIENCES: AnnouncementAudience[] = ['Students', 'Parents', 'Staff'];

/** Write an announcement to a class, a grade or the whole organization; delivered in-app (and by email). */
@Component({
  selector: 'app-announcements',
  imports: [MatIconModule, TranslocoDirective, OrgShortDayPipe],
  template: `
    <ng-container *transloco="let t">
      <div class="page">
        <header class="page-header">
          <div>
            <h1 class="page-title">{{ t('ann.title') }}</h1>
            <p class="page-subtitle">{{ t('ann.subtitle') }}</p>
          </div>
        </header>

        <div class="grid gap-6 lg:grid-cols-5">
          @let d = draft();
          <section class="card card-body flex flex-col gap-4 lg:col-span-3">
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="field">
                <span class="field-label">{{ t('ann.to') }}</span>
                <select class="select" [value]="d.scope" (change)="patch({ scope: $any($event.target).value })">
                  <option value="Class">{{ t('ann.toClass') }}</option>
                  @if (canManage()) {
                    <option value="Grade">{{ t('ann.toGrade') }}</option>
                    <option value="Organization">{{ t('ann.toOrg') }}</option>
                  }
                </select>
              </label>
              @if (d.scope === 'Class') {
                <label class="field">
                  <span class="field-label">{{ t('ann.class') }}</span>
                  <select class="select" [value]="d.classGroupId ?? ''" (change)="patch({ classGroupId: $any($event.target).value || null })">
                    <option value="">{{ t('ann.choose') }}</option>
                    @for (c of classes(); track c.id) { <option [value]="c.id" [selected]="c.id === d.classGroupId">{{ c.name }}</option> }
                  </select>
                </label>
              }
              @if (d.scope === 'Grade') {
                <label class="field">
                  <span class="field-label">{{ t('ann.grade') }}</span>
                  <select class="select" [value]="d.gradeId ?? ''" (change)="patch({ gradeId: +$any($event.target).value || null })">
                    <option value="">{{ t('ann.choose') }}</option>
                    @for (g of gradesInUse(); track g) { <option [value]="g">{{ gradeName(g) }}</option> }
                  </select>
                </label>
              }
            </div>

            <fieldset>
              <legend class="field-label mb-1">{{ t('ann.audience') }}</legend>
              <div class="flex flex-wrap gap-x-5">
                @for (a of audiences; track a) {
                  <label class="check"><input type="checkbox" [checked]="d.audience.includes(a)" (change)="toggleAudience(a, $any($event.target).checked)" />{{ t('ann.' + a) }}</label>
                }
              </div>
            </fieldset>

            <label class="field">
              <span class="field-label">{{ t('ann.titleField') }}</span>
              <input class="input" maxlength="200" [value]="d.title" (input)="patch({ title: $any($event.target).value })" />
            </label>
            <label class="field">
              <span class="field-label">{{ t('ann.body') }}</span>
              <textarea class="textarea min-h-36" maxlength="5000" [value]="d.body" (input)="patch({ body: $any($event.target).value })"></textarea>
            </label>
            <label class="check"><input type="checkbox" [checked]="d.sendEmail" (change)="patch({ sendEmail: $any($event.target).checked })" />{{ t('ann.email') }}</label>

            @if (errors().length) { <div class="alert alert-danger" role="alert">{{ errors().join(' ') }}</div> }
            @if (sentTo() !== null) { <div class="alert alert-success" role="status">{{ t('ann.sentTo', { count: sentTo() }) }}</div> }
            <button type="button" class="btn btn-primary self-stretch sm:self-end" [disabled]="sending() || !canSend()" (click)="send()">
              <mat-icon svgIcon="send" class="icon-size-5 flip-rtl" />{{ t('ann.send') }}
            </button>
          </section>

          <section class="flex flex-col gap-3 lg:col-span-2">
            <h2 class="section-title">{{ t('ann.history') }}</h2>
            @for (a of history(); track a.id) {
              <article class="card card-body">
                <div class="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 class="text-base font-extrabold">{{ a.title }}</h3>
                  <span class="text-xs text-muted">{{ a.publishedAtUtc | orgShortDay: true }}</span>
                </div>
                <p class="mt-1 line-clamp-4 text-[0.95rem] whitespace-pre-line">{{ a.body }}</p>
                <div class="mt-3 flex flex-wrap gap-1.5">
                  <span class="badge badge-info">{{ a.className ?? (a.scope === 'Organization' ? t('ann.everyone') : gradeName(a.gradeId)) }}</span>
                  @for (aud of a.audience; track aud) { <span class="badge badge-neutral">{{ t('ann.' + aud) }}</span> }
                  <span class="badge badge-neutral">{{ t('ann.recipients', { count: a.recipientCount }) }}</span>
                </div>
                @if (a.authorName) { <p class="mt-2 text-xs text-muted">{{ a.authorName }}</p> }
              </article>
            } @empty {
              <div class="empty"><mat-icon svgIcon="megaphone" class="icon-size-8" />{{ t('ann.none') }}</div>
            }
          </section>
        </div>
      </div>
    </ng-container>
  `,
})
export default class AnnouncementsComponent {
  protected orgContext = inject(OrgContextService);
  private school = inject(SchoolService);
  private route = inject(ActivatedRoute);
  private lookups = inject(LookupsService);
  private i18n = inject(I18nService);
  private transloco = inject(TranslocoService);

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
    this.lookups.getEducationGrades().subscribe(g => this.grades.set(g));
  }

  protected gradeName(gradeId: number | null): string {
    const grade = this.grades().find(g => g.id === gradeId);
    if (!grade) return this.transloco.translate('ann.grade');
    return this.i18n.lang() === 'ar' ? grade.nameAr || grade.nameEn : grade.nameEn || grade.nameAr;
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
    this.school
      .publishAnnouncement(this.org, {
        ...d,
        title: d.title.trim(),
        body: d.body.trim(),
        classGroupId: d.scope === 'Class' ? d.classGroupId : null,
        gradeId: d.scope === 'Grade' ? d.gradeId : null,
      })
      .subscribe({
        next: sent => {
          this.sending.set(false);
          this.draft.update(x => ({ ...x, title: '', body: '' }));
          this.sentTo.set(sent.recipientCount);
          this.loadHistory();
        },
        error: (err: unknown) => {
          this.sending.set(false);
          this.errors.set(errorMessages(err, this.transloco.translate('error.generic')));
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
