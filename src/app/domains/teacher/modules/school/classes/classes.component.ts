import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';

import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { Branch, ClassSummary, GenderSegment, SchoolService } from '@/app/core/school/school.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';
import { ClassForm } from './class-form';

/** Classes (school) / groups (center) of the organization, plus branches for class managers. */
@Component({
  selector: 'app-classes',
  imports: [MatButtonModule, MatIconModule, RouterLink, ClassForm],
  template: `
    <div class="mx-auto max-w-6xl space-y-6 p-6">
      <header class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold">{{ isCenter() ? 'Groups' : 'Classes' }}</h1>
          <p class="text-sm text-neutral-500">Rosters, subjects and teachers, attendance.</p>
        </div>
        <div class="flex gap-2">
          <div class="flex rounded-lg border p-0.5">
            <button matButton [class.bg-primary-50]="mine()" (click)="setMine(true)">Mine</button>
            <button matButton [class.bg-primary-50]="!mine()" (click)="setMine(false)">All</button>
          </div>
          @if (canManage()) {
            <button matButton="filled" (click)="creating.set(true)"><mat-icon svgIcon="plus" /> New {{ isCenter() ? 'group' : 'class' }}</button>
          }
        </div>
      </header>

      @if (creating()) {
        <section class="rounded-2xl border bg-white p-6 dark:bg-neutral-800">
          <h2 class="mb-4 font-semibold">New {{ isCenter() ? 'group' : 'class' }}</h2>
          <class-form (saved)="created($event)" (cancelled)="creating.set(false)" />
        </section>
      }

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @for (c of classes(); track c.id) {
          <a class="block rounded-2xl border bg-white p-5 transition hover:shadow-md dark:bg-neutral-800" [routerLink]="orgContext.path('classes', c.id)">
            <div class="flex items-start justify-between gap-2">
              <h2 class="text-lg font-semibold">{{ c.name }}</h2>
              @if (c.gender !== 'Mixed') {
                <span class="rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-700">{{ c.gender }}</span>
              }
            </div>
            <p class="mt-1 text-sm text-neutral-500">
              {{ c.studentCount }}{{ c.capacity ? ' / ' + c.capacity : '' }} students
              @if (c.branchName) { · {{ c.branchName }} }
            </p>
            @if (c.homeroomTeacherName) {
              <p class="mt-1 text-sm">Homeroom: {{ c.homeroomTeacherName }}</p>
            }
            @if (c.schedule.length) {
              <p class="mt-1 text-xs text-neutral-500">
                @for (s of c.schedule; track $index) { {{ s.day.slice(0, 3) }} {{ s.startTime.slice(0, 5) }}{{ $last ? '' : ' · ' }} }
              </p>
            }
          </a>
        } @empty {
          <p class="text-neutral-500">{{ mine() ? 'You are not assigned to any class yet.' : 'No classes yet.' }}</p>
        }
      </div>

      @if (canManage()) {
        <section class="space-y-3 rounded-2xl border bg-white p-6 dark:bg-neutral-800">
          <h2 class="font-semibold">Branches / campuses</h2>
          @for (b of branches(); track b.id) {
            <div class="flex items-center justify-between gap-2 border-b pb-2 last:border-0">
              <span>{{ b.name }} <span class="text-sm text-neutral-500">· {{ b.gender }}</span></span>
              <button matIconButton aria-label="Delete branch" (click)="deleteBranch(b)"><mat-icon svgIcon="trash-2" /></button>
            </div>
          }
          <form class="flex flex-wrap gap-2" (submit)="$event.preventDefault(); addBranch()">
            <input class="min-w-48 flex-1 rounded-lg border px-3 py-2 dark:bg-neutral-900" placeholder="e.g. Girls campus" maxlength="150"
                   [value]="branchName()" (input)="branchName.set($any($event.target).value)" />
            <select class="rounded-lg border px-3 py-2 dark:bg-neutral-900" [value]="branchGender()" (change)="branchGender.set($any($event.target).value)">
              <option value="Mixed">Mixed</option>
              <option value="Boys">Boys</option>
              <option value="Girls">Girls</option>
            </select>
            <button matButton="outlined" type="submit" [disabled]="!branchName().trim()">Add branch</button>
          </form>
          @if (branchError()) { <p class="text-sm text-red-600">{{ branchError() }}</p> }
        </section>
      }
    </div>
  `,
})
export default class ClassesComponent {
  protected orgContext = inject(OrgContextService);
  private school = inject(SchoolService);
  private router = inject(Router);

  protected canManage = computed(() => this.orgContext.can('classes.manage'));
  protected isCenter = computed(() => this.orgContext.activeOrg()?.type === 'Center');
  protected mine = signal(!this.orgContext.can('classes.manage'));
  protected creating = signal(false);
  protected classes = signal<ClassSummary[]>([]);
  protected branches = signal<Branch[]>([]);
  protected branchName = signal('');
  protected branchGender = signal<GenderSegment>('Mixed');
  protected branchError = signal<string | null>(null);

  constructor() {
    this.load();
    if (this.canManage()) this.loadBranches();
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
      error: (err: unknown) => this.branchError.set(errorMessages(err, 'The branch could not be saved.').join(' ')),
    });
  }

  protected deleteBranch(branch: Branch): void {
    this.branchError.set(null);
    this.school.deleteBranch(this.org, branch.id).subscribe({
      next: () => this.loadBranches(),
      error: (err: unknown) => this.branchError.set(errorMessages(err, 'The branch could not be deleted.').join(' ')),
    });
  }

  private load(): void {
    this.school.classes(this.org, this.mine()).subscribe(c => this.classes.set(c));
  }

  private loadBranches(): void {
    this.school.branches(this.org).subscribe(b => this.branches.set(b));
  }

  private get org(): string {
    return this.orgContext.requireActiveSlug();
  }
}
