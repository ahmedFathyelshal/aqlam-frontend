import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { OrgDatePipe } from '@/app/core/organizations/org-date';
import { ChildOverview, FamilyService } from '@/app/core/school/family.service';

/** Read-only view of one child in one school or center: classes, courses, attendance and results. */
@Component({
  selector: 'app-child-overview',
  imports: [RouterLink, OrgDatePipe],
  template: `
    <a class="text-sm text-neutral-500 hover:underline" routerLink="/parent">← My children</a>
    @if (notFound()) {
      <p class="mt-6 text-neutral-500">This child is not linked to your account in this organization.</p>
    }
    @if (overview(); as o) {
      <header class="mt-2">
        <h1 class="text-2xl font-bold">{{ o.fullName }}</h1>
        <p class="text-sm text-neutral-500">{{ orgName() }}{{ o.classes.length ? ' · ' + o.classes.join(', ') : '' }}</p>
      </header>

      <section class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        @for (stat of stats(); track stat.label) {
          <div class="rounded-2xl border bg-white p-4 text-center dark:bg-neutral-800">
            <p class="text-2xl font-bold" [class]="stat.tone">{{ stat.value }}</p>
            <p class="text-xs text-neutral-500">{{ stat.label }} (30 days)</p>
          </div>
        }
      </section>

      @if (o.attendance.recent.length) {
        <section class="mt-6 space-y-2">
          <h2 class="font-semibold">Recent attendance</h2>
          <ul class="divide-y rounded-2xl border bg-white dark:bg-neutral-800">
            @for (a of o.attendance.recent; track $index) {
              <li class="flex items-center justify-between gap-2 p-3 text-sm">
                <span>{{ a.date | orgDate: 'date' : calendar() }}{{ a.startTime ? ' · ' + a.startTime.slice(0, 5) : '' }} · {{ a.className }}</span>
                <span [class.text-red-600]="a.status === 'Absent'" [class.text-amber-600]="a.status === 'Late'" class="font-medium">{{ a.status }}{{ a.note ? ' — ' + a.note : '' }}</span>
              </li>
            }
          </ul>
        </section>
      }

      <section class="mt-6 space-y-2">
        <h2 class="font-semibold">Courses</h2>
        @for (c of o.courses; track c.courseId) {
          <div class="rounded-2xl border bg-white p-4 dark:bg-neutral-800">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium">{{ c.title }}</span>
              <span class="text-sm">{{ c.progressPercent }}%</span>
            </div>
            <div class="mt-2 h-2 rounded-full bg-neutral-100 dark:bg-neutral-700">
              <div class="h-2 rounded-full bg-primary-600" [style.width.%]="c.progressPercent"></div>
            </div>
            <p class="mt-1 text-xs text-neutral-500">{{ c.lastAccessedAtUtc ? 'Last studied ' + (c.lastAccessedAtUtc | orgDate: 'date' : calendar()) : 'Not started yet' }}</p>
          </div>
        } @empty {
          <p class="text-sm text-neutral-500">No courses yet.</p>
        }
      </section>

      <section class="mt-6 space-y-2">
        <h2 class="font-semibold">Latest results</h2>
        @for (g of o.grades; track $index) {
          <div class="flex items-center justify-between gap-2 rounded-xl border bg-white p-3 text-sm dark:bg-neutral-800">
            <span>{{ g.kind }} · {{ g.lessonTitle }}</span>
            <span class="font-medium">
              @if (g.score !== null) { {{ g.score }} / {{ g.maxScore }} } @else { {{ g.status === 'ReturnedForRevision' ? 'Returned for revision' : g.status }} }
            </span>
          </div>
        } @empty {
          <p class="text-sm text-neutral-500">No results yet.</p>
        }
      </section>
    }
  `,
})
export default class ChildOverviewComponent {
  private family = inject(FamilyService);
  private orgContext = inject(OrgContextService);
  private route = inject(ActivatedRoute);

  private org = this.route.snapshot.paramMap.get('org')!;
  protected overview = signal<ChildOverview | null>(null);
  protected notFound = signal(false);

  private membership = computed(() => this.orgContext.memberships().find(m => m.slug === this.org));
  protected orgName = computed(() => this.membership()?.name ?? '');
  protected calendar = computed(() => this.membership()?.calendar ?? 'Gregorian');
  protected stats = computed(() => {
    const a = this.overview()?.attendance;
    return a
      ? [
          { label: 'Present', value: a.present, tone: 'text-green-600' },
          { label: 'Absent', value: a.absent, tone: 'text-red-600' },
          { label: 'Late', value: a.late, tone: 'text-amber-600' },
          { label: 'Excused', value: a.excused, tone: '' },
        ]
      : [];
  });

  constructor() {
    this.family.overview(this.org, this.route.snapshot.paramMap.get('childId')!).subscribe({
      next: o => this.overview.set(o),
      error: () => this.notFound.set(true),
    });
  }
}
