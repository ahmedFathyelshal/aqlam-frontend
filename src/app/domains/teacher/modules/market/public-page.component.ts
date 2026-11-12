import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { Gender, TeacherCard } from '@/app/core/marketplace/marketplace.service';
import { LookupNames } from '@/app/core/marketplace/lookup-names.service';
import { PublicProfile, TeacherBusinessService } from '@/app/core/marketplace/teacher-business.service';
import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';
import { AqMonogram, AqTeacherCard } from '@/app/shared/marketplace/market-ui';

const MAX_PHOTO = 256 * 1024;

/**
 * The independent teacher's public page and "show me in search" switch. A public name and the teacher's gender are
 * required to appear (parents filter by it); a public course is only recommended.
 */
@Component({
  selector: 'app-public-page',
  imports: [RouterLink, MatIconModule, TranslocoDirective, AqTeacherCard, AqMonogram],
  template: `
    <ng-container *transloco="let t">
      <div class="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header class="page-header">
          <div>
            <h1 class="page-title">{{ t('publicPage.title') }}</h1>
            <p class="page-subtitle">{{ t('publicPage.subtitle') }}</p>
          </div>
          @if (profile()?.isListed && !blocking().length) {
            <a class="btn btn-outline" [routerLink]="['/t', profile()!.slug]" target="_blank"><mat-icon svgIcon="external-link" class="icon-size-4" />{{ t('publicPage.open') }}</a>
          }
        </header>

        @if (forbidden()) {
          <p class="alert alert-info">{{ t('publicPage.onlyIndependent') }}</p>
        } @else if (profile(); as p) {
          <!-- Status -->
          <section class="card card-body mb-6" aria-live="polite">
            @if (listed() && !blocking().length) {
              <p class="flex items-center gap-2 font-bold text-primary-700"><mat-icon svgIcon="circle-check" class="icon-size-5" />{{ t('publicPage.listed') }}</p>
              <p class="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span dir="ltr" class="text-secondary-600">{{ publicUrl() }}</span>
                <button type="button" class="btn btn-ghost btn-sm" (click)="copy()">{{ copied() ? t('publicPage.copied') : t('publicPage.copy') }}</button>
              </p>
            } @else if (listed()) {
              <p class="font-bold text-warning-700">{{ t('publicPage.missingTitle') }}</p>
            } @else {
              <p class="text-muted">{{ t('publicPage.hidden') }}</p>
            }
            @if (missing().length) {
              <ul class="mt-3 flex flex-col gap-1.5">
                @for (m of missing(); track m) {
                  <li class="flex items-center gap-2 text-[0.95rem]">
                    <mat-icon [svgIcon]="m === 'publicCourse' ? 'lightbulb' : 'circle-alert'" class="icon-size-4" [class]="m === 'publicCourse' ? 'text-secondary-600' : 'text-warning-700'" />
                    {{ t('publicPage.missing.' + m) }}
                    @if (m === 'publicCourse') { <span class="badge badge-info">{{ t('publicPage.recommended') }}</span> }
                  </li>
                }
              </ul>
            }
          </section>

          <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <form class="card card-body flex flex-col gap-5" (submit)="$event.preventDefault(); save()">
              <label class="flex cursor-pointer items-start gap-3 rounded-ui border border-line p-4" [class.border-primary-600]="listed()">
                <input type="checkbox" class="mt-1 size-5 accent-primary-600" [checked]="listed()" (change)="listed.set(!listed())" />
                <span>
                  <span class="block font-bold">{{ t('publicPage.listSwitch') }}</span>
                  <span class="field-hint">{{ t('publicPage.listHint') }}</span>
                </span>
              </label>

              <label class="field">
                <span class="field-label">{{ t('publicPage.publicName') }}</span>
                <input id="pp-name" class="input" maxlength="100" [value]="name()" (input)="name.set($any($event.target).value)" />
                <span class="field-hint">{{ t('publicPage.publicNameHint') }}</span>
              </label>

              <fieldset class="field">
                <legend class="field-label">{{ t('publicPage.gender') }}</legend>
                <div class="segmented">
                  @for (g of genders; track g) {
                    <button type="button" class="segment min-h-11" [attr.aria-pressed]="gender() === g" (click)="gender.set(g)">{{ t('market.gender.' + g) }}</button>
                  }
                </div>
                <span class="field-hint">{{ t('publicPage.genderHint') }}</span>
              </fieldset>

              <label class="field">
                <span class="field-label">{{ t('publicPage.headline') }}</span>
                <input class="input" maxlength="160" [value]="headline()" (input)="headline.set($any($event.target).value)" />
                <span class="field-hint">{{ t('publicPage.headlineHint') }} · {{ headline().length }}/160</span>
              </label>

              <label class="field">
                <span class="field-label">{{ t('publicPage.city') }}</span>
                <input class="input" maxlength="80" [value]="city()" (input)="city.set($any($event.target).value)" />
                <span class="field-hint">{{ t('publicPage.cityHint') }}</span>
              </label>

              <label class="field">
                <span class="field-label">{{ t('publicPage.bio') }}</span>
                <textarea class="textarea min-h-40" maxlength="2000" [value]="bio()" (input)="bio.set($any($event.target).value)"></textarea>
                <span class="field-hint">{{ t('publicPage.bioHint') }} · {{ bio().length }}/2000</span>
              </label>

              <div class="flex flex-wrap items-center gap-4 border-t border-line-soft pt-5">
                <aq-monogram [name]="name() || '؟'" [photoUrl]="p.photoUrl" [size]="72" />
                <div class="flex min-w-56 flex-1 flex-col gap-1.5">
                  <span class="field-label">{{ t('publicPage.photo') }}</span>
                  <div class="flex flex-wrap gap-2">
                    <label class="btn btn-outline cursor-pointer" [class.opacity-50]="uploading()">
                      <mat-icon svgIcon="upload" class="icon-size-4" />{{ p.photoUrl ? t('publicPage.change') : t('publicPage.upload') }}
                      <input type="file" class="sr-only" accept="image/png,image/jpeg,image/webp" [disabled]="uploading()" (change)="upload($any($event.target))" />
                    </label>
                    @if (p.photoUrl) { <button type="button" class="btn btn-ghost" [disabled]="uploading()" (click)="removePhoto()">{{ t('publicPage.removePhoto') }}</button> }
                  </div>
                  <span class="field-hint">{{ t('publicPage.photoHint') }}</span>
                  @if (photoError()) { <span class="field-error" role="alert">{{ photoError() }}</span> }
                </div>
              </div>

              <div class="sticky bottom-0 -mx-5 -mb-5 flex items-center justify-end gap-3 border-t border-line bg-white p-3 max-sm:bottom-16">
                @if (errors().length) { <p class="field-error grow" role="alert">{{ errors().join(' ') }}</p> }
                @else if (saved()) { <p class="grow text-sm font-bold text-primary-700">{{ t('publicPage.saved') }}</p> }
                <button type="submit" class="btn btn-primary" [disabled]="saving()">{{ t('publicPage.save') }}</button>
              </div>
            </form>

            <aside class="lg:sticky lg:top-20">
              <p class="mb-2 text-sm font-bold text-muted">{{ t('publicPage.preview') }}</p>
              <aq-teacher-card [teacher]="previewCard()" />
            </aside>
          </div>
        } @else {
          <div class="skeleton h-96 w-full" aria-hidden="true"></div>
        }
      </div>
    </ng-container>
  `,
})
export default class PublicPageComponent {
  private api = inject(TeacherBusinessService);
  private orgContext = inject(OrgContextService);
  private transloco = inject(TranslocoService);

  protected readonly genders: Gender[] = ['Female', 'Male'];
  protected profile = signal<PublicProfile | null>(null);
  protected forbidden = signal(false);
  protected name = signal('');
  protected headline = signal('');
  protected city = signal('');
  protected bio = signal('');
  protected gender = signal<Gender | null>(null);
  protected listed = signal(false);
  protected saving = signal(false);
  protected saved = signal(false);
  protected uploading = signal(false);
  protected copied = signal(false);
  protected errors = signal<string[]>([]);
  protected photoError = signal<string | null>(null);

  /** What is still missing, from the form as typed (the saved profile says the same after saving). */
  protected missing = computed(() => {
    const list: string[] = [];
    if (!this.name().trim()) list.push('publicName');
    if (!this.gender()) list.push('gender');
    if (!this.profile()?.publicCourseCount) list.push('publicCourse');
    return list;
  });
  protected blocking = computed(() => this.missing().filter(m => m !== 'publicCourse'));
  protected publicUrl = computed(() => `${typeof location === 'undefined' ? '' : location.origin}/t/${this.profile()?.slug ?? ''}`);

  protected previewCard = computed<TeacherCard>(() => {
    const p = this.profile();
    return {
      slug: p?.slug ?? '',
      name: this.name().trim() || '…',
      headline: this.headline().trim() || null,
      city: this.city().trim() || null,
      countryCode: 'SA',
      gender: this.gender() ?? 'Female',
      photoUrl: p?.photoUrl ?? null,
      subjectIds: [],
      gradeIds: [],
      courseCount: p?.publicCourseCount ?? 0,
    };
  });

  constructor() {
    inject(LookupNames).load();
    const org = this.orgContext.activeOrg()?.slug ?? '';
    this.api.profile(org).subscribe({
      next: p => this.fill(p),
      error: err => (err?.status === 403 ? this.forbidden.set(true) : this.errors.set(errorMessages(err, 'Error'))),
    });
  }

  protected save(): void {
    this.saving.set(true);
    this.saved.set(false);
    this.errors.set([]);
    this.api
      .saveProfile(this.org(), {
        publicName: this.name().trim() || null,
        headline: this.headline().trim() || null,
        bio: this.bio().trim() || null,
        city: this.city().trim() || null,
        gender: this.gender(),
        isListed: this.listed(),
      })
      .subscribe({
        next: p => (this.fill(p), this.saving.set(false), this.saved.set(true)),
        error: err => (this.saving.set(false), this.errors.set(errorMessages(err, 'Error'))),
      });
  }

  protected upload(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_PHOTO) {
      this.photoError.set(this.transloco.translate('publicPage.tooBig'));
      return;
    }
    this.uploading.set(true);
    this.photoError.set(null);
    this.api.uploadPhoto(this.org(), file).subscribe({
      next: p => (this.profile.set(p), this.uploading.set(false)),
      error: err => (this.uploading.set(false), this.photoError.set(errorMessages(err, 'Error').join(' '))),
    });
  }

  protected removePhoto(): void {
    this.uploading.set(true);
    this.api.removePhoto(this.org()).subscribe({
      next: p => (this.profile.set(p), this.uploading.set(false)),
      error: () => this.uploading.set(false),
    });
  }

  protected copy(): void {
    navigator.clipboard?.writeText(this.publicUrl()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  private org(): string {
    return this.orgContext.activeOrg()?.slug ?? '';
  }

  private fill(p: PublicProfile): void {
    this.profile.set(p);
    this.name.set(p.publicName ?? '');
    this.headline.set(p.headline ?? '');
    this.city.set(p.city ?? '');
    this.bio.set(p.bio ?? '');
    this.gender.set(p.gender);
    this.listed.set(p.isListed);
  }
}
