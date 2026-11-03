import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { AuthService } from '@/app/core/auth/auth.service';
import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { AcademicsService, ReportCard } from '@/app/core/school/academics.service';
import { AqReportCard } from './report-card';

/**
 * The report card page, for three audiences chosen by the route:
 * staff (`data.staff`, any term), a parent (`:childId`, published terms) and the student (published terms).
 */
@Component({
  selector: 'aq-report-card-page',
  imports: [MatIconModule, RouterLink, TranslocoDirective, AqReportCard],
  template: `
    <ng-container *transloco="let t">
      <div class="page-narrow">
        <a class="back-link print:hidden" [routerLink]="backLink()"><mat-icon svgIcon="chevron-right" class="icon-size-4 ltr:rotate-180" />{{ t('report.back') }}</a>
        @if (card(); as c) {
          <aq-report-card [card]="c" [calendar]="calendar()" />
        } @else if (notAvailable()) {
          <div class="empty mt-4">{{ t('report.notAvailable') }}</div>
        } @else {
          <p class="py-8 text-center text-muted">{{ t('loading') }}</p>
        }
      </div>
    </ng-container>
  `,
})
export default class ReportCardPage {
  private route = inject(ActivatedRoute);
  private academics = inject(AcademicsService);
  private auth = inject(AuthService);
  private orgContext = inject(OrgContextService);

  private params = this.route.snapshot.paramMap;
  private staff = !!this.route.snapshot.data['staff'];
  private childId = this.params.get('childId');
  private termId = this.params.get('termId')!;
  private org = this.staff ? this.orgContext.requireActiveSlug() : this.params.get('org')!;

  protected card = signal<ReportCard | null>(null);
  protected notAvailable = signal(false);

  protected calendar = computed(() => this.orgContext.memberships().find(m => m.slug === this.org)?.calendar ?? 'Gregorian');
  protected backLink = computed<(string | number)[] | string>(() => {
    if (this.staff) return this.orgContext.path('classes');
    return this.childId ? ['/parent', this.org, 'children', this.childId] : '/student/dashboard';
  });

  constructor() {
    const request = this.staff
      ? this.academics.staffReportCard(this.org, this.params.get('studentId')!, this.termId)
      : this.academics.familyReportCard(this.org, this.childId ?? this.auth.user()?.id ?? '', this.termId);
    request.subscribe({ next: c => this.card.set(c), error: () => this.notAvailable.set(true) });
  }
}
