import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { AuthService } from '@/app/core/auth/auth.service';
import { DataRequest, LegalService } from '@/app/core/legal/legal.service';
import { I18nService } from '@/app/core/transloco/i18n.service';
import { LEGAL_DOCS, LEGAL_VERSION } from '@/app/core/transloco/i18n/legal';
import { errorMessages } from '@/app/core/utils/api-error.utils';

/** The terms of use or the privacy policy (route data `doc`). The privacy page also holds the personal data requests. */
@Component({
  selector: 'app-legal-page',
  imports: [RouterLink, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <article class="mx-auto max-w-3xl px-4 py-8 lg:py-12">
        <div class="alert alert-warning mb-6" role="note">{{ t('legal.draftBanner') }}</div>
        <h1 class="page-title">{{ doc().title }}</h1>
        <p class="mt-1 text-sm text-muted">{{ t('legal.version') }}: <span dir="ltr">{{ version }}</span></p>
        @for (s of doc().sections; track s.heading) {
          <section class="mt-6">
            <h2 class="section-title">{{ s.heading }}</h2>
            <p class="mt-1 leading-relaxed">{{ s.text }}</p>
          </section>
        }

        @if (isPrivacy) {
          <section class="card card-body mt-10" aria-labelledby="my-data">
            <h2 id="my-data" class="section-title">{{ t('legal.requestsTitle') }}</h2>
            @if (auth.isAuthenticated()) {
              <p class="field-hint mt-1">{{ t('legal.requestsLead') }}</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <button type="button" class="btn btn-secondary" [disabled]="busy()" (click)="download()">{{ t('legal.requestExport') }}</button>
                <button type="button" class="btn btn-ghost text-danger-700" [disabled]="busy()" (click)="request('Delete')">{{ t('legal.requestDelete') }}</button>
              </div>
              @if (sent()) { <div class="alert alert-success mt-3" role="status">{{ t('legal.requestSent') }}</div> }
              @if (error()) { <p class="field-error mt-2" role="alert">{{ error() }}</p> }
              @if (requests().length) {
                <ul class="mt-3 divide-y divide-line-soft rounded-ui border border-line">
                  @for (r of requests(); track r.id) {
                    <li class="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                      <span>{{ r.type === 'Export' ? t('legal.requestExportLabel') : t('legal.requestDeleteLabel') }}</span>
                      <span class="badge badge-neutral">{{ t('legal.request' + r.status) }}</span>
                    </li>
                  }
                </ul>
              }
            } @else {
              <p class="mt-1 text-muted">{{ t('legal.requestSignIn') }} <a routerLink="/auth/sign-in" class="font-bold">{{ t('auth.signIn') }}</a></p>
            }
          </section>
        }
      </article>
    </ng-container>
  `,
})
export default class LegalPage {
  protected auth = inject(AuthService);
  private legal = inject(LegalService);
  private i18n = inject(I18nService);
  private route = inject(ActivatedRoute);

  protected readonly version = LEGAL_VERSION;
  protected isPrivacy = this.route.snapshot.data['doc'] === 'privacy';
  protected doc = computed(() => LEGAL_DOCS[this.i18n.lang() === 'ar' ? 'ar' : 'en'][this.isPrivacy ? 'privacy' : 'terms']);
  protected requests = signal<DataRequest[]>([]);
  protected busy = signal(false);
  protected sent = signal(false);
  protected error = signal<string | null>(null);

  constructor() {
    if (this.isPrivacy && this.auth.isAuthenticated()) this.load();
  }

  protected download(): void {
    this.busy.set(true);
    this.error.set(null);
    this.legal.downloadData(null).subscribe({
      next: () => (this.busy.set(false), this.load()),
      error: (err: unknown) => (this.busy.set(false), this.error.set(errorMessages(err, 'Error').join(' '))),
    });
  }

  protected request(type: 'Export' | 'Delete'): void {
    if (type === 'Delete' && !confirm(this.i18n.lang() === 'ar' ? 'هل تريد طلب حذف حسابك؟' : 'Request deletion of your account?')) return;
    this.busy.set(true);
    this.sent.set(false);
    this.error.set(null);
    this.legal.createRequest(type).subscribe({
      next: () => (this.busy.set(false), this.sent.set(true), this.load()),
      error: (err: unknown) => (this.busy.set(false), this.error.set(errorMessages(err, 'Error').join(' '))),
    });
  }

  private load(): void {
    this.legal.myRequests().subscribe(r => this.requests.set(r));
  }
}
