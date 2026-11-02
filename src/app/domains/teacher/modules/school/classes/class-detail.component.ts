import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '@/app/core/auth/auth.service';
import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { ClassDetail, Member, RosterResult, SchoolService, TeachingAssignment } from '@/app/core/school/school.service';
import { LookupDto, LookupsService } from '@/app/core/services/lookups.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';
import { ClassForm } from './class-form';

/** One class: roster, subjects with their teachers (each subject is a course), and shortcuts to attendance. */
@Component({
  selector: 'app-class-detail',
  imports: [MatButtonModule, MatIconModule, RouterLink, ClassForm],
  template: `
    <div class="mx-auto max-w-6xl space-y-6 p-6">
      @if (detail(); as d) {
        <header class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <a class="text-sm text-neutral-500 hover:underline" [routerLink]="orgContext.path('classes')">← Classes</a>
            <h1 class="text-2xl font-bold">{{ d.class.name }}</h1>
            <p class="text-sm text-neutral-500">
              {{ d.class.studentCount }}{{ d.class.capacity ? ' / ' + d.class.capacity : '' }} students
              @if (d.class.gender !== 'Mixed') { · {{ d.class.gender }} }
              @if (d.class.branchName) { · {{ d.class.branchName }} }
              @if (d.class.homeroomTeacherName) { · Homeroom: {{ d.class.homeroomTeacherName }} }
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            @if (orgContext.can('attendance.take')) {
              <a matButton="filled" [routerLink]="orgContext.path('classes', d.class.id, 'attendance')"><mat-icon svgIcon="calendar-check" /> Attendance</a>
            }
            @if (orgContext.can('announcements.send')) {
              <a matButton="outlined" [routerLink]="orgContext.path('announcements')" [queryParams]="{ classId: d.class.id }"><mat-icon svgIcon="megaphone" /> Announce</a>
            }
            @if (canManage()) {
              <button matButton (click)="editing.set(!editing())"><mat-icon svgIcon="pencil" /> Edit</button>
            }
          </div>
        </header>

        @if (editing()) {
          <section class="rounded-2xl border bg-white p-6 dark:bg-neutral-800">
            <class-form [value]="d.class" (saved)="edited()" (cancelled)="editing.set(false)" />
            <div class="mt-4 border-t pt-4">
              <button matButton class="text-red-600" (click)="deleteClass()"><mat-icon svgIcon="trash-2" /> Delete class</button>
              @if (deleteError()) { <span class="ms-2 text-sm text-red-600">{{ deleteError() }}</span> }
            </div>
          </section>
        }

        <div class="grid gap-6 lg:grid-cols-2">
          <!-- Subjects -->
          <section class="space-y-3 rounded-2xl border bg-white p-6 dark:bg-neutral-800">
            <h2 class="font-semibold">Subjects & teachers</h2>
            @for (a of d.assignments; track a.id) {
              <div class="flex flex-wrap items-center gap-2 border-b pb-2 last:border-0">
                <div class="min-w-0 flex-1">
                  <p class="font-medium">{{ a.subjectName }}</p>
                  <p class="text-sm text-neutral-500">{{ a.teacherName || a.teacherUserName }} · course {{ a.courseStatus }}</p>
                </div>
                @if (canManage() || a.teacherUserId === me()) {
                  <a matButton [routerLink]="orgContext.path('courses', a.courseId, 'curriculum')">Open course</a>
                }
                @if (canManage()) {
                  <select class="rounded-lg border px-2 py-1 text-sm dark:bg-neutral-900" aria-label="Change teacher" [value]="a.teacherUserId"
                          (change)="changeTeacher(a, $any($event.target).value)">
                    @for (t of teachers(); track t.userId) { <option [value]="t.userId">{{ t.fullName || t.userName }}</option> }
                  </select>
                  <button matIconButton aria-label="Remove subject" (click)="removeAssignment(a)"><mat-icon svgIcon="trash-2" /></button>
                }
              </div>
            } @empty {
              <p class="text-sm text-neutral-500">No subjects yet.</p>
            }

            @if (canManage()) {
              <div class="grid gap-2 border-t pt-3 sm:grid-cols-[1fr_1fr_auto]">
                <select class="rounded-lg border px-3 py-2 dark:bg-neutral-900" aria-label="Subject" [value]="subjectId() ?? ''" (change)="subjectId.set(+$any($event.target).value || null)">
                  <option value="">Custom subject…</option>
                  @for (s of subjects(); track s.id) { <option [value]="s.id">{{ s.nameAr }} · {{ s.nameEn }}</option> }
                </select>
                @if (!subjectId()) {
                  <input class="rounded-lg border px-3 py-2 dark:bg-neutral-900" placeholder="Subject name" maxlength="100"
                         [value]="subjectName()" (input)="subjectName.set($any($event.target).value)" />
                }
                <select class="rounded-lg border px-3 py-2 dark:bg-neutral-900" aria-label="Teacher" [value]="teacherId()" (change)="teacherId.set($any($event.target).value)">
                  <option value="">Teacher…</option>
                  @for (t of teachers(); track t.userId) { <option [value]="t.userId">{{ t.fullName || t.userName }}</option> }
                </select>
                <button matButton="outlined" [disabled]="!teacherId() || (!subjectId() && !subjectName().trim())" (click)="assign()">Assign</button>
              </div>
              <p class="text-xs text-neutral-500">Assigning creates a private course for this class; its students get it when the teacher publishes.</p>
            }
            @if (assignError()) { <p class="text-sm text-red-600">{{ assignError() }}</p> }
          </section>

          <!-- Roster -->
          <section class="space-y-3 rounded-2xl border bg-white p-6 dark:bg-neutral-800">
            <h2 class="font-semibold">Students</h2>
            @if (canManage()) {
              <textarea class="min-h-20 w-full rounded-lg border px-3 py-2 text-sm dark:bg-neutral-900" dir="ltr"
                        placeholder="Usernames, one per line or separated by commas"
                        [value]="userNames()" (input)="userNames.set($any($event.target).value)"></textarea>
              <div class="flex justify-end">
                <button matButton="outlined" [disabled]="!userNames().trim()" (click)="addStudents()"><mat-icon svgIcon="user-plus" /> Add students</button>
              </div>
              @if (rosterResults().length) {
                <ul class="space-y-1 rounded-lg bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
                  @for (r of rosterResults(); track r.userName) {
                    <li [class.text-red-600]="r.status === 'Failed'">{{ r.userName }}: {{ r.error ?? r.status }}</li>
                  }
                </ul>
              }
            }
            @for (s of d.students; track s.userId) {
              <div class="flex items-center justify-between gap-2 border-b pb-2 last:border-0">
                <div>
                  <p class="font-medium">{{ s.fullName }}</p>
                  <p class="text-xs text-neutral-500" dir="ltr">{{ s.userName }}{{ s.gender ? ' · ' + s.gender : '' }}</p>
                </div>
                @if (canManage()) {
                  <button matIconButton aria-label="Remove from class" (click)="removeStudent(s.userId)"><mat-icon svgIcon="x" /></button>
                }
              </div>
            } @empty {
              <p class="text-sm text-neutral-500">No students yet.</p>
            }
          </section>
        </div>
      }
    </div>
  `,
})
export default class ClassDetailComponent {
  protected orgContext = inject(OrgContextService);
  private school = inject(SchoolService);
  private lookups = inject(LookupsService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private classId = this.route.snapshot.paramMap.get('classId')!;
  protected canManage = computed(() => this.orgContext.can('classes.manage'));
  protected me = computed(() => this.auth.user()?.id);

  protected detail = signal<ClassDetail | null>(null);
  protected members = signal<Member[]>([]);
  protected subjects = signal<LookupDto[]>([]);
  protected teachers = computed(() => this.members().filter(m => m.roles.includes('Teacher') && m.status === 'Active'));

  protected editing = signal(false);
  protected deleteError = signal<string | null>(null);
  protected userNames = signal('');
  protected rosterResults = signal<RosterResult[]>([]);
  protected subjectId = signal<number | null>(null);
  protected subjectName = signal('');
  protected teacherId = signal('');
  protected assignError = signal<string | null>(null);

  constructor() {
    this.load();
    if (this.canManage()) {
      this.school.members(this.org).subscribe(m => this.members.set(m));
      this.lookups.getSubjects().subscribe(s => this.subjects.set(s));
    }
  }

  protected edited(): void {
    this.editing.set(false);
    this.load();
  }

  protected deleteClass(): void {
    this.school.deleteClass(this.org, this.classId).subscribe({
      next: () => this.router.navigate(this.orgContext.path('classes')),
      error: (err: unknown) => this.deleteError.set(errorMessages(err, 'The class could not be deleted.').join(' ')),
    });
  }

  protected addStudents(): void {
    const names = this.userNames().split(/[\s,;]+/).map(n => n.trim()).filter(Boolean);
    this.school.addStudents(this.org, this.classId, names).subscribe({
      next: results => {
        this.rosterResults.set(results);
        this.userNames.set(results.filter(r => r.status === 'Failed').map(r => r.userName).join('\n'));
        this.load();
      },
      error: (err: unknown) => this.rosterResults.set(errorMessages(err, 'Students could not be added.').map(e => ({ userName: '', status: 'Failed', error: e }))),
    });
  }

  protected removeStudent(userId: string): void {
    this.school.removeStudent(this.org, this.classId, userId).subscribe(() => this.load());
  }

  protected assign(): void {
    this.assignError.set(null);
    this.school
      .assignTeacher(this.org, this.classId, { subjectId: this.subjectId(), subjectName: this.subjectId() ? null : this.subjectName().trim(), teacherUserId: this.teacherId() })
      .subscribe({
        next: () => {
          this.subjectId.set(null);
          this.subjectName.set('');
          this.teacherId.set('');
          this.load();
        },
        error: (err: unknown) => this.assignError.set(errorMessages(err, 'The teacher could not be assigned.').join(' ')),
      });
  }

  protected changeTeacher(assignment: TeachingAssignment, teacherUserId: string): void {
    this.school.changeTeacher(this.org, this.classId, assignment.id, teacherUserId).subscribe({
      next: () => this.load(),
      error: (err: unknown) => this.assignError.set(errorMessages(err, 'The teacher could not be changed.').join(' ')),
    });
  }

  protected removeAssignment(assignment: TeachingAssignment): void {
    this.school.removeAssignment(this.org, this.classId, assignment.id).subscribe(() => this.load());
  }

  private load(): void {
    this.school.classDetail(this.org, this.classId).subscribe(d => this.detail.set(d));
  }

  private get org(): string {
    return this.orgContext.requireActiveSlug();
  }
}
