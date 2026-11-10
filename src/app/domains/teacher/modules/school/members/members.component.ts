import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { OrgShortDayPipe } from '@/app/core/organizations/org-date';
import { Gender, Member, MemberImportReport, ParentInvite, ParentLink, SchoolService } from '@/app/core/school/school.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';

const ROLES = ['Student', 'Parent', 'Teacher', 'Assistant', 'AcademicCoordinator', 'Admin', 'Finance'];

/** Member directory: add people, bulk import from Excel, approvals, gender (for boys'/girls' classes) and parents. */
@Component({
  selector: 'app-members',
  imports: [MatIconModule, TranslocoDirective, OrgShortDayPipe],
  template: `
    <ng-container *transloco="let t">
      <div class="page">
        <header class="page-header print:hidden">
          <div>
            <h1 class="page-title">{{ t('members.title') }}</h1>
            <p class="page-subtitle">{{ t('members.count', { count: members().length }) }}</p>
          </div>
          @if (canManage()) {
            <!-- Phones show the list first; adding people opens on demand. -->
            <button type="button" class="btn btn-secondary w-full sm:w-auto lg:hidden" [attr.aria-expanded]="adding()" aria-controls="add-members" (click)="adding.set(!adding())">
              <mat-icon [svgIcon]="adding() ? 'x' : 'user-plus'" class="icon-size-5" />{{ adding() ? t('action.close') : t('members.addMembers') }}
            </button>
          }
        </header>

        @if (canManage()) {
          <section id="add-members" class="mb-5 gap-4 print:hidden lg:!grid lg:grid-cols-2" [class.grid]="adding()" [class.hidden]="!adding()">
            <div class="card card-body flex flex-col gap-3">
              <h2 class="section-title">{{ t('members.addExisting') }}</h2>
              <div class="flex flex-wrap gap-2">
                <input class="input min-w-40 flex-1" dir="ltr" [placeholder]="t('members.userName')" [attr.aria-label]="t('members.userName')" [value]="newUserName()" (input)="newUserName.set($any($event.target).value)" />
                <select class="select w-auto" [attr.aria-label]="t('members.role')" [value]="newRole()" (change)="newRole.set($any($event.target).value)">
                  @for (r of roles; track r) { <option [value]="r">{{ t('role.' + r) }}</option> }
                </select>
                <button type="button" class="btn btn-secondary" [disabled]="!newUserName().trim()" (click)="add()">{{ t('action.add') }}</button>
              </div>
              @if (addError()) { <p class="field-error">{{ addError() }}</p> }
            </div>
            <div class="card card-body flex flex-col gap-3">
              <h2 class="section-title">{{ t('members.import') }}</h2>
              <p class="field-hint">{{ t('members.importHint') }}</p>
              <div class="flex flex-wrap gap-2">
                <button type="button" class="btn btn-ghost" (click)="downloadTemplate()">{{ t('members.template') }}</button>
                <label class="btn btn-secondary">
                  {{ t('members.upload') }}
                  <input type="file" class="sr-only" accept=".xlsx" (change)="upload($any($event.target))" />
                </label>
              </div>
              @if (importError()) { <p class="field-error">{{ importError() }}</p> }
            </div>
          </section>
        }

        @if (report(); as r) {
          <section class="card mb-5">
            <div class="card-header print:hidden">
              <h2 class="section-title">{{ t('members.report', { created: r.created, failed: r.failed }) }}</h2>
              <div class="flex gap-2">
                <button type="button" class="btn btn-secondary btn-sm" (click)="print()"><mat-icon svgIcon="printer" class="icon-size-4" />{{ t('members.printCredentials') }}</button>
                <button type="button" class="btn btn-ghost btn-sm" (click)="report.set(null)">{{ t('action.close') }}</button>
              </div>
            </div>
            <div class="alert alert-warning m-4 print:hidden">{{ t('members.reportWarn') }}</div>
            <div class="overflow-x-auto">
              <table class="table">
                <thead><tr><th>#</th><th>{{ t('members.name') }}</th><th>{{ t('members.role') }}</th><th>{{ t('members.userName') }}</th><th>{{ t('members.tempPassword') }}</th></tr></thead>
                <tbody>
                  @for (row of r.rows; track row.rowNumber) {
                    <tr [class.text-danger-700]="row.status === 'Failed'">
                      <td>{{ row.rowNumber }}</td>
                      <td>{{ row.fullName }}</td>
                      <td>{{ t('role.' + row.role) }}</td>
                      @if (row.status === 'Created') {
                        <td class="font-mono" dir="ltr">{{ row.userName }}</td><td class="font-mono" dir="ltr">{{ row.temporaryPassword }}</td>
                      } @else {
                        <td colspan="2">{{ row.errors.join(' ') }}</td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }

        <div class="mb-3 flex flex-wrap gap-2 print:hidden">
          <input class="input min-w-48 flex-1 sm:max-w-sm" type="search" [placeholder]="t('members.search')" [attr.aria-label]="t('members.search')" [value]="search()" (input)="search.set($any($event.target).value)" />
          <select class="select w-auto" [attr.aria-label]="t('members.role')" [value]="roleFilter()" (change)="roleFilter.set($any($event.target).value)">
            <option value="">{{ t('members.allRoles') }}</option>
            @for (r of roles; track r) { <option [value]="r">{{ t('role.' + r) }}</option> }
          </select>
        </div>

        <section class="card print:hidden">
          @for (m of filtered(); track m.userId) {
            <div class="border-b border-line-soft px-4 py-3 last:border-b-0 sm:px-5">
              <div class="flex flex-wrap items-center gap-3">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary-100 font-extrabold text-secondary-600">{{ (m.fullName || m.userName).charAt(0) }}</span>
                <div class="min-w-0 flex-1">
                  <p class="truncate font-bold">{{ m.fullName || m.userName }}</p>
                  <p class="text-sm text-muted">
                    <span dir="ltr">{{ m.userName }}</span> · {{ roleNames(m, t) }} · {{ t('members.joined', { date: (m.joinedAtUtc | orgShortDay) }) }}
                  </p>
                </div>
                @if (m.status !== 'Active') {
                  <span class="badge" [class]="m.status === 'Pending' ? 'badge-warning' : 'badge-neutral'">{{ t('members.status.' + m.status) }}</span>
                }
                <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  @if (canManage() && m.status === 'Pending') {
                    <button type="button" class="btn btn-primary btn-sm" (click)="approve(m)">{{ t('members.approve') }}</button>
                  }
                  @if (canManage()) {
                    <select class="select min-h-10 w-auto text-sm" [attr.aria-label]="t('members.gender')" [value]="m.gender ?? ''" (change)="setGender(m, $any($event.target).value || null)">
                      <option value="">{{ t('members.gender') }} —</option>
                      <option value="Male">{{ t('gender.Male') }}</option>
                      <option value="Female">{{ t('gender.Female') }}</option>
                    </select>
                  } @else if (m.gender) {
                    <span class="badge badge-neutral">{{ t('gender.' + m.gender) }}</span>
                  }
                  @if (m.roles.includes('Student')) {
                    <button type="button" class="btn btn-ghost btn-sm" [attr.aria-expanded]="openStudent() === m.userId" (click)="toggleParents(m)"><mat-icon svgIcon="users-round" class="icon-size-4" />{{ t('members.parents') }}</button>
                  }
                </div>
              </div>

              @if (openStudent() === m.userId) {
                <div class="mt-3 flex flex-col gap-2 rounded-ui bg-page p-3 sm:ms-13">
                  @for (p of parents(); track p.userId) {
                    <div class="flex items-center justify-between gap-2">
                      <span><span class="font-bold">{{ p.fullName || p.userName }}</span> <span class="text-sm text-muted" dir="ltr">{{ p.userName }}{{ p.phoneNumber ? ' · ' + p.phoneNumber : '' }}</span></span>
                      @if (canManage()) {
                        <button type="button" class="btn btn-ghost btn-sm" (click)="unlink(m, p)">{{ t('members.unlink') }}</button>
                      }
                    </div>
                  } @empty {
                    <p class="text-muted">{{ t('members.noParents') }}</p>
                  }
                  @if (canManage() && parents().length < 2) {
                    <div class="flex flex-wrap gap-2">
                      <input class="input min-h-10 min-w-40 flex-1" dir="ltr" [placeholder]="t('members.parentUserName')" [attr.aria-label]="t('members.parentUserName')" [value]="parentUserName()" (input)="parentUserName.set($any($event.target).value)" />
                      <button type="button" class="btn btn-secondary btn-sm" [disabled]="!parentUserName().trim()" (click)="link(m)">{{ t('members.link') }}</button>
                      <button type="button" class="btn btn-ghost btn-sm" (click)="invite(m)"><mat-icon svgIcon="qr-code" class="icon-size-4" />{{ t('members.familyCode') }}</button>
                    </div>
                  }
                  @if (inviteCode(); as code) {
                    <div class="rounded-ui border border-dashed border-secondary-300 bg-white p-3">
                      <p class="text-sm">{{ t('members.codeFor', { name: code.childName }) }}</p>
                      <p class="mt-1 font-mono text-2xl font-bold tracking-[0.3em]" dir="ltr">{{ code.code }}</p>
                      <p class="text-xs text-muted">{{ t('members.codeValid', { date: (code.expiresAtUtc | orgShortDay) }) }}</p>
                    </div>
                  }
                  @if (parentError()) { <p class="field-error">{{ parentError() }}</p> }
                </div>
              }
            </div>
          } @empty {
            <p class="px-5 py-10 text-center text-muted">{{ t('members.noMatch') }}</p>
          }
        </section>
      </div>
    </ng-container>
  `,
})
export default class MembersComponent {
  protected orgContext = inject(OrgContextService);
  private school = inject(SchoolService);
  private transloco = inject(TranslocoService);

  protected readonly roles = ROLES;
  protected canManage = computed(() => this.orgContext.can('members.manage'));
  protected adding = signal(false);
  protected members = signal<Member[]>([]);
  protected search = signal('');
  protected roleFilter = signal('');
  protected filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const role = this.roleFilter();
    return this.members().filter(m => (!role || m.roles.includes(role)) && (!q || m.fullName.toLowerCase().includes(q) || m.userName.toLowerCase().includes(q)));
  });

  protected newUserName = signal('');
  protected newRole = signal('Student');
  protected addError = signal<string | null>(null);
  protected report = signal<MemberImportReport | null>(null);
  protected importError = signal<string | null>(null);

  protected openStudent = signal<string | null>(null);
  protected parents = signal<ParentLink[]>([]);
  protected parentUserName = signal('');
  protected inviteCode = signal<ParentInvite | null>(null);
  protected parentError = signal<string | null>(null);

  constructor() {
    this.load();
  }

  protected roleNames(member: Member, t: (key: string) => string): string {
    return member.roles.map(r => t('role.' + r)).join('، ');
  }

  protected add(): void {
    this.addError.set(null);
    this.school.addMember(this.org, this.newUserName().trim(), [this.newRole()]).subscribe({
      next: () => {
        this.newUserName.set('');
        this.load();
      },
      error: (err: unknown) => this.addError.set(this.message(err)),
    });
  }

  protected approve(member: Member): void {
    this.school.approveMember(this.org, member.userId).subscribe(() => this.load());
  }

  protected downloadTemplate(): void {
    this.school.importTemplate(this.org).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'members-import-template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  protected upload(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.importError.set(null);
    this.school.importMembers(this.org, file).subscribe({
      next: report => {
        this.report.set(report);
        this.load();
      },
      error: (err: unknown) => this.importError.set(this.message(err)),
    });
  }

  protected print(): void {
    window.print();
  }

  protected setGender(member: Member, gender: Gender | null): void {
    this.school.setGender(this.org, member.userId, gender).subscribe(updated =>
      this.members.update(all => all.map(m => (m.userId === updated.userId ? updated : m))));
  }

  protected toggleParents(student: Member): void {
    this.inviteCode.set(null);
    this.parentError.set(null);
    if (this.openStudent() === student.userId) {
      this.openStudent.set(null);
      return;
    }
    this.openStudent.set(student.userId);
    this.loadParents(student);
  }

  protected link(student: Member): void {
    this.parentError.set(null);
    this.school.linkParent(this.org, student.userId, this.parentUserName().trim()).subscribe({
      next: () => {
        this.parentUserName.set('');
        this.loadParents(student);
        this.load();
      },
      error: (err: unknown) => this.parentError.set(this.message(err)),
    });
  }

  protected unlink(student: Member, parent: ParentLink): void {
    this.school.unlinkParent(this.org, student.userId, parent.userId).subscribe(() => this.loadParents(student));
  }

  protected invite(student: Member): void {
    this.parentError.set(null);
    this.school.parentInvite(this.org, student.userId).subscribe({
      next: code => this.inviteCode.set(code),
      error: (err: unknown) => this.parentError.set(this.message(err)),
    });
  }

  private message(err: unknown): string {
    return errorMessages(err, this.transloco.translate('error.generic')).join(' ');
  }

  private loadParents(student: Member): void {
    this.school.parents(this.org, student.userId).subscribe(p => this.parents.set(p));
  }

  private load(): void {
    this.school.members(this.org).subscribe(m => this.members.set(m));
  }

  private get org(): string {
    return this.orgContext.requireActiveSlug();
  }
}
