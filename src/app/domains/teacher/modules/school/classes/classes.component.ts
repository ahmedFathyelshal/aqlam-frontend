import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { AcademicsService, AcademicYear } from '@/app/core/school/academics.service';
import { Branch, ClassSummary, GenderSegment, SchoolService } from '@/app/core/school/school.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';
import { ClassForm } from './class-form';

/** Classes (school) / groups (center): table on laptops, cards on phones; campuses for class managers. */
@Component({
  selector: 'app-classes',
  imports: [MatIconModule, RouterLink, TranslocoDirective, ClassForm],
  template: `
    <ng-container *transloco="let t">
      <div class="page">
        <header class="page-header">
          <div>
            <h1 class="page-title">{{ isCenter() ? t('classes.titleCenter') : t('classes.title') }}</h1>
            <p class="page-subtitle">{{ t('classes.subtitle') }}</p>
          </div>
          @if (canManage()) {
            <button type="button" class="btn btn-primary" (click)="creating.set(true)"><mat-icon svgIcon="plus" class="icon-size-5" />{{ isCenter() ? t('classes.newGroup') : t('classes.new') }}</button>
          }
        </header>

        @if (creating()) {
          <section class="card card-body mb-5">
            <h2 class="section-title mb-4">{{ isCenter() ? t('classes.newGroup') : t('classes.new') }}</h2>
            <class-form (saved)="created($event)" (cancelled)="creating.set(false)" />
          </section>
        }

        <div class="mb-4 flex flex-wrap items-center gap-3">
          <div class="segmented" role="group">
            <button type="button" class="segment" [attr.aria-pressed]="mine()" (click)="setMine(true)">{{ t('classes.mine') }}</button>
            <button type="button" class="segment" [attr.aria-pressed]="!mine()" (click)="setMine(false)">{{ t('classes.all') }}</button>
          </div>
          @if (branches().length) {
            <select class="select w-auto min-w-44" [attr.aria-label]="t('classes.form.branch')" [value]="branchFilter()" (change)="branchFilter.set($any($event.target).value)">
              <option value="">{{ t('classes.allBranches') }}</option>
              @for (b of branches(); track b.id) { <option [value]="b.id">{{ b.name }}</option> }
            </select>
          }
          @if (years().length > 1) {
            <select class="select w-auto min-w-44" [attr.aria-label]="t('years.field')" (change)="yearFilter.set($any($event.target).value)">
              <option value="">{{ t('years.filterAll') }}</option>
              @for (y of years(); track y.id) { <option [value]="y.id">{{ y.name }}</option> }
            </select>
          }
        </div>

        <!-- Laptop: table -->
        <div class="table-wrap hidden md:block">
          <table class="table">
            <thead>
              <tr>
                <th>{{ t('classes.form.name') }}</th>
                <th>{{ t('classes.form.branch') }}</th>
                <th>{{ t('classes.form.homeroom') }}</th>
                <th>{{ t('classes.detail.students') }}</th>
                <th><span class="sr-only">{{ t('action.open') }}</span></th>
              </tr>
            </thead>
            <tbody>
              @for (c of visible(); track c.id) {
                <tr>
                  <td>
                    <a class="font-extrabold text-ink no-underline hover:underline" [routerLink]="orgContext.path('classes', c.id)">{{ c.name }}</a>
                    @if (c.gender !== 'Mixed') { <span class="badge badge-info ms-2">{{ t('gender.' + c.gender) }}</span> }
                    @if (c.schedule.length) {
                      <div class="text-sm text-muted">@for (s of c.schedule; track $index) { {{ t('day.' + s.day) }} {{ s.startTime.slice(0, 5) }}{{ $last ? '' : ' · ' }} }</div>
                    }
                  </td>
                  <td>{{ c.branchName ?? '—' }}</td>
                  <td>{{ c.homeroomTeacherName ?? '—' }}</td>
                  <td>{{ c.studentCount }}{{ c.capacity ? ' / ' + c.capacity : '' }}</td>
                  <td class="text-end whitespace-nowrap">
                    @if (orgContext.can('attendance.take')) {
                      <a class="btn btn-secondary btn-sm" [routerLink]="orgContext.path('classes', c.id, 'attendance')">{{ t('classes.detail.attendance') }}</a>
                    }
                    <a class="btn btn-ghost btn-sm" [routerLink]="orgContext.path('classes', c.id)">{{ t('action.open') }}</a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
          @if (!visible().length) { <p class="px-5 py-10 text-center text-muted">{{ mine() ? t('classes.emptyMine') : t('classes.empty') }}</p> }
        </div>

        <!-- Phone: cards -->
        <div class="flex flex-col gap-3 md:hidden">
          @for (c of visible(); track c.id) {
            <article class="card">
              <a class="block px-4 pt-4 text-ink no-underline" [routerLink]="orgContext.path('classes', c.id)">
                <div class="flex items-center justify-between gap-2">
                  <h2 class="text-lg font-extrabold">{{ c.name }}</h2>
                  @if (c.gender !== 'Mixed') { <span class="badge badge-info">{{ t('gender.' + c.gender) }}</span> }
                </div>
                <p class="text-sm text-muted">
                  {{ t('classes.students', { count: c.studentCount }) }}{{ c.branchName ? ' · ' + c.branchName : '' }}
                </p>
                @if (c.homeroomTeacherName) { <p class="text-sm">{{ t('classes.homeroom', { name: c.homeroomTeacherName }) }}</p> }
              </a>
              @if (orgContext.can('attendance.take')) {
                <div class="p-4 pt-3">
                  <a class="btn btn-primary btn-block" [routerLink]="orgContext.path('classes', c.id, 'attendance')"><mat-icon svgIcon="calendar-check" class="icon-size-5" />{{ t('classes.detail.attendance') }}</a>
                </div>
              }
            </article>
          } @empty {
            <div class="empty"><mat-icon svgIcon="school" class="icon-size-8" />{{ mine() ? t('classes.emptyMine') : t('classes.empty') }}</div>
          }
        </div>

        @if (canManage()) {
          <section class="card mt-6">
            <div class="card-header"><h2 class="section-title">{{ t('classes.branches') }}</h2></div>
            @for (b of branches(); track b.id) {
              <div class="list-row">
                <span class="flex-1 font-bold">{{ b.name }}</span>
                <span class="badge badge-neutral">{{ t('gender.' + b.gender) }}</span>
                <button type="button" class="btn-icon" [attr.aria-label]="t('action.delete')" (click)="deleteBranch(b)"><mat-icon svgIcon="trash-2" class="icon-size-5" /></button>
              </div>
            }
            <form class="flex flex-wrap gap-2 p-4 sm:px-5" (submit)="$event.preventDefault(); addBranch()">
              <input class="input min-w-48 flex-1" maxlength="150" [placeholder]="t('classes.branchName')" [attr.aria-label]="t('classes.branchName')" [value]="branchName()" (input)="branchName.set($any($event.target).value)" />
              <select class="select w-auto" [attr.aria-label]="t('classes.form.gender')" [value]="branchGender()" (change)="branchGender.set($any($event.target).value)">
                <option value="Mixed">{{ t('gender.Mixed') }}</option>
                <option value="Boys">{{ t('gender.Boys') }}</option>
                <option value="Girls">{{ t('gender.Girls') }}</option>
              </select>
              <button type="submit" class="btn btn-secondary" [disabled]="!branchName().trim()">{{ t('classes.addBranch') }}</button>
            </form>
            @if (branchError()) { <p class="field-error px-5 pb-4">{{ branchError() }}</p> }
          </section>
        }
      </div>
    </ng-container>
  `,
})
export default class ClassesComponent {
  protected orgContext = inject(OrgContextService);
  private school = inject(SchoolService);
  private router = inject(Router);
  private academics = inject(AcademicsService);

  protected canManage = computed(() => this.orgContext.can('classes.manage'));
  protected isCenter = computed(() => this.orgContext.activeOrg()?.type === 'Center');
  protected mine = signal(!this.orgContext.can('classes.manage'));
  protected creating = signal(false);
  protected classes = signal<ClassSummary[]>([]);
  protected branches = signal<Branch[]>([]);
  protected branchFilter = signal('');
  protected years = signal<AcademicYear[]>([]);
  protected yearFilter = signal('');
  protected visible = computed(() => this.classes().filter(c =>
    (!this.branchFilter() || c.branchId === this.branchFilter()) && (!this.yearFilter() || c.academicYearId === this.yearFilter())));
  protected branchName = signal('');
  protected branchGender = signal<GenderSegment>('Mixed');
  protected branchError = signal<string | null>(null);

  constructor() {
    this.load();
    this.loadBranches();
  }

  protected setMine(mine: boolean): void {
    this.mine.set(mine);
    this.load();
  }

  protected created(saved: ClassSummary): void {
    this.creating.set(false);
    this.router.navigate(this.orgContext.path('classes', saved.id));
  }

  protected addBranch(): void {
    this.branchError.set(null);
    this.school.saveBranch(this.org, { name: this.branchName().trim(), gender: this.branchGender(), address: null }).subscribe({
      next: () => {
        this.branchName.set('');
        this.loadBranches();
      },
      error: (err: unknown) => this.branchError.set(errorMessages(err, 'Error').join(' ')),
    });
  }

  protected deleteBranch(branch: Branch): void {
    this.branchError.set(null);
    this.school.deleteBranch(this.org, branch.id).subscribe({
      next: () => this.loadBranches(),
      error: (err: unknown) => this.branchError.set(errorMessages(err, 'Error').join(' ')),
    });
  }

  private load(): void {
    this.academics.years(this.org).subscribe({ next: y => this.years.set(y), error: () => this.years.set([]) });
    this.school.classes(this.org, this.mine()).subscribe(c => this.classes.set(c));
  }

  private loadBranches(): void {
    this.school.branches(this.org).subscribe({ next: b => this.branches.set(b), error: () => this.branches.set([]) });
  }

  private get org(): string {
    return this.orgContext.requireActiveSlug();
  }
}
