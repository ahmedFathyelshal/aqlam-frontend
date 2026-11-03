import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { AuthService } from '@/app/core/auth/auth.service';
import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { ClassDetail, Member, RosterResult, SchoolService, TeachingAssignment } from '@/app/core/school/school.service';
import { LookupDto, LookupsService } from '@/app/core/services/lookups.service';
import { I18nService } from '@/app/core/transloco/i18n.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';
import { ClassForm } from './class-form';

/** One class: subjects with their teachers (each subject is a course) and the roster. */
@Component({
  selector: 'app-class-detail',
  imports: [MatIconModule, RouterLink, TranslocoDirective, ClassForm],
  template: `
    <ng-container *transloco="let t">
      <div class="page">
        @if (detail(); as d) {
          <a class="back-link" [routerLink]="orgContext.path('classes')"><mat-icon svgIcon="chevron-right" class="icon-size-4 ltr:rotate-180" />{{ t('classes.title') }}</a>
          <header class="page-header">
            <div>
              <h1 class="page-title">{{ d.class.name }}</h1>
              <p class="page-subtitle">
                {{ t('classes.students', { count: d.class.studentCount }) }}{{ d.class.capacity ? ' / ' + d.class.capacity : '' }}
                @if (d.class.gender !== 'Mixed') { · {{ t('gender.' + d.class.gender) }} }
                @if (d.class.branchName) { · {{ d.class.branchName }} }
                @if (d.class.homeroomTeacherName) { · {{ t('classes.homeroom', { name: d.class.homeroomTeacherName }) }} }
              </p>
            </div>
            <div class="flex w-full flex-wrap gap-2 sm:w-auto">
              @if (orgContext.can('attendance.take')) {
                <a class="btn btn-primary flex-1 sm:flex-none" [routerLink]="orgContext.path('classes', d.class.id, 'attendance')"><mat-icon svgIcon="calendar-check" class="icon-size-5" />{{ t('classes.detail.attendance') }}</a>
              }
              @if (orgContext.can('announcements.send')) {
                <a class="btn btn-secondary flex-1 sm:flex-none" [routerLink]="orgContext.path('announcements')" [queryParams]="{ classId: d.class.id }"><mat-icon svgIcon="megaphone" class="icon-size-5" />{{ t('classes.detail.announce') }}</a>
              }
              @if (canManage()) {
                <button type="button" class="btn btn-ghost" (click)="editing.set(!editing())"><mat-icon svgIcon="pencil" class="icon-size-5" />{{ t('action.edit') }}</button>
              }
            </div>
          </header>

          @if (editing()) {
            <section class="card card-body mb-5">
              <class-form [value]="d.class" (saved)="edited()" (cancelled)="editing.set(false)" />
              <div class="mt-5 flex flex-wrap items-center gap-3 border-t border-line-soft pt-4">
                <button type="button" class="btn btn-danger" (click)="deleteClass()"><mat-icon svgIcon="trash-2" class="icon-size-5" />{{ t('classes.detail.deleteClass') }}</button>
                @if (deleteError()) { <span class="field-error">{{ deleteError() }}</span> }
              </div>
            </section>
          }

          <div class="grid gap-5 lg:grid-cols-2">
            <section class="card">
              <div class="card-header"><h2 class="section-title">{{ t('classes.detail.subjects') }}</h2></div>
              @for (a of d.assignments; track a.id) {
                <div class="list-row flex-wrap">
                  <div class="min-w-0 flex-1">
                    <p class="font-bold">{{ a.subjectName }}</p>
                    <p class="text-sm text-muted">{{ a.teacherName || a.teacherUserName }}</p>
                  </div>
                  <span class="badge" [class]="statusBadge(a.courseStatus)">{{ t('courseStatus.' + (a.courseStatus ?? 'Draft')) }}</span>
                  @if (canManage() || a.teacherUserId === me()) {
                    <a class="btn btn-ghost btn-sm" [routerLink]="orgContext.path('courses', a.courseId, 'curriculum')">{{ t('classes.detail.openCourse') }}</a>
                  }
                  @if (canManage()) {
                    <div class="flex w-full items-center gap-2 sm:w-auto">
                      <select class="select min-h-10 flex-1 text-sm sm:w-44" [attr.aria-label]="t('classes.detail.changeTeacher')" [value]="a.teacherUserId" (change)="changeTeacher(a, $any($event.target).value)">
                        @for (m of teachers(); track m.userId) { <option [value]="m.userId" [selected]="m.userId === a.teacherUserId">{{ m.fullName || m.userName }}</option> }
                      </select>
                      <button type="button" class="btn-icon" [attr.aria-label]="t('classes.detail.removeSubject')" (click)="removeAssignment(a)"><mat-icon svgIcon="trash-2" class="icon-size-5" /></button>
                    </div>
                  }
                </div>
              } @empty {
                <p class="px-5 py-6 text-center text-muted">{{ t('classes.detail.noSubjects') }}</p>
              }

              @if (canManage()) {
                <div class="flex flex-col gap-3 border-t border-line-soft p-4 sm:px-5">
                  <div class="grid gap-3 sm:grid-cols-2">
                    <label class="field">
                      <span class="field-label">{{ t('classes.detail.subject') }}</span>
                      <select class="select" [value]="subjectId() ?? ''" (change)="subjectId.set(+$any($event.target).value || null)">
                        <option value="">{{ t('classes.detail.customSubject') }}</option>
                        @for (s of subjects(); track s.id) { <option [value]="s.id">{{ name(s) }}</option> }
                      </select>
                    </label>
                    @if (!subjectId()) {
                      <label class="field">
                        <span class="field-label">{{ t('classes.detail.subjectName') }}</span>
                        <input class="input" maxlength="100" [value]="subjectName()" (input)="subjectName.set($any($event.target).value)" />
                      </label>
                    }
                    <label class="field">
                      <span class="field-label">{{ t('classes.detail.teacher') }}</span>
                      <select class="select" [value]="teacherId()" (change)="teacherId.set($any($event.target).value)">
                        <option value="">{{ t('classes.detail.chooseTeacher') }}</option>
                        @for (m of teachers(); track m.userId) { <option [value]="m.userId">{{ m.fullName || m.userName }}</option> }
                      </select>
                    </label>
                  </div>
                  <p class="field-hint">{{ t('classes.detail.assignHint') }}</p>
                  <button type="button" class="btn btn-secondary self-start" [disabled]="!teacherId() || (!subjectId() && !subjectName().trim())" (click)="assign()">{{ t('classes.detail.assign') }}</button>
                  @if (assignError()) { <p class="field-error">{{ assignError() }}</p> }
                </div>
              }
            </section>

            <section class="card">
              <div class="card-header"><h2 class="section-title">{{ t('classes.detail.students') }}</h2><span class="text-sm text-muted">{{ d.students.length }}</span></div>
              @if (canManage()) {
                <div class="flex flex-col gap-2 border-b border-line-soft p-4 sm:px-5">
                  <label class="field">
                    <span class="field-label">{{ t('classes.detail.addStudents') }}</span>
                    <textarea class="textarea" dir="ltr" [placeholder]="t('classes.detail.usernames')" [value]="userNames()" (input)="userNames.set($any($event.target).value)"></textarea>
                  </label>
                  <button type="button" class="btn btn-secondary self-start" [disabled]="!userNames().trim()" (click)="addStudents()"><mat-icon svgIcon="user-plus" class="icon-size-5" />{{ t('classes.detail.addStudents') }}</button>
                  @if (rosterResults().length) {
                    <ul class="flex flex-col gap-1 text-sm">
                      @for (r of rosterResults(); track $index) {
                        <li class="flex flex-wrap items-center gap-2">
                          <span dir="ltr" class="font-bold">{{ r.userName }}</span>
                          <span class="badge" [class]="r.status === 'Failed' ? 'badge-danger' : r.status === 'Added' ? 'badge-success' : 'badge-neutral'">
                            {{ r.status === 'Added' ? t('classes.detail.added') : r.status === 'AlreadyInClass' ? t('classes.detail.already') : r.error }}
                          </span>
                        </li>
                      }
                    </ul>
                  }
                </div>
              }
              @for (s of d.students; track s.userId) {
                <div class="list-row">
                  <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary-100 font-extrabold text-secondary-600">{{ (s.fullName || s.userName).charAt(0) }}</span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate font-bold">{{ s.fullName }}</p>
                    <p class="text-sm text-muted"><span dir="ltr">{{ s.userName }}</span>{{ s.gender ? ' · ' + t('gender.' + s.gender) : '' }}</p>
                  </div>
                  @if (canManage()) {
                    <button type="button" class="btn-icon" [attr.aria-label]="t('classes.detail.removeStudent')" (click)="removeStudent(s.userId)"><mat-icon svgIcon="x" class="icon-size-5" /></button>
                  }
                </div>
              } @empty {
                <p class="px-5 py-6 text-center text-muted">{{ t('classes.detail.noStudents') }}</p>
              }
            </section>
          </div>
        }
      </div>
    </ng-container>
  `,
})
export default class ClassDetailComponent {
  protected orgContext = inject(OrgContextService);
  private school = inject(SchoolService);
  private lookups = inject(LookupsService);
  private auth = inject(AuthService);
  private i18n = inject(I18nService);
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

  protected name(item: LookupDto): string {
    return this.i18n.lang() === 'ar' ? item.nameAr || item.nameEn : item.nameEn || item.nameAr;
  }

  protected statusBadge(status: string | null): string {
    return status === 'Published' ? 'badge-success' : status === 'Scheduled' ? 'badge-info' : status === 'Draft' || !status ? 'badge-warning' : 'badge-neutral';
  }

  protected edited(): void {
    this.editing.set(false);
    this.load();
  }

  protected deleteClass(): void {
    this.school.deleteClass(this.org, this.classId).subscribe({
      next: () => this.router.navigate(this.orgContext.path('classes')),
      error: (err: unknown) => this.deleteError.set(errorMessages(err, 'Error').join(' ')),
    });
  }

  protected addStudents(): void {
    const names = this.userNames().split(/[\s,;،]+/).map(n => n.trim()).filter(Boolean);
    this.school.addStudents(this.org, this.classId, names).subscribe({
      next: results => {
        this.rosterResults.set(results);
        this.userNames.set(results.filter(r => r.status === 'Failed').map(r => r.userName).join('\n'));
        this.load();
      },
      error: (err: unknown) => this.rosterResults.set(errorMessages(err, 'Error').map(e => ({ userName: '', status: 'Failed', error: e }))),
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
        error: (err: unknown) => this.assignError.set(errorMessages(err, 'Error').join(' ')),
      });
  }

  protected changeTeacher(assignment: TeachingAssignment, teacherUserId: string): void {
    this.school.changeTeacher(this.org, this.classId, assignment.id, teacherUserId).subscribe({
      next: () => this.load(),
      error: (err: unknown) => this.assignError.set(errorMessages(err, 'Error').join(' ')),
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
