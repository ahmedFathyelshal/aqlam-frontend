import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { OrgDatePipe } from '@/app/core/organizations/org-date';
import { Gender, Member, MemberImportReport, ParentInvite, ParentLink, SchoolService } from '@/app/core/school/school.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';

const ROLES = ['Student', 'Parent', 'Teacher', 'Assistant', 'AcademicCoordinator', 'Admin', 'Finance'];

/** Member directory: add people, bulk import from Excel, gender (for boys'/girls' classes) and students' parents. */
@Component({
  selector: 'app-members',
  imports: [MatButtonModule, MatIconModule, OrgDatePipe],
  template: `
    <div class="mx-auto max-w-6xl space-y-6 p-6 print:p-0">
      <header class="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h1 class="text-2xl font-bold">Members</h1>
          <p class="text-sm text-neutral-500">{{ members().length }} people</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <input class="rounded-lg border px-3 py-2 dark:bg-neutral-900" placeholder="Search name or username" [value]="search()" (input)="search.set($any($event.target).value)" />
          <select class="rounded-lg border px-3 py-2 dark:bg-neutral-900" aria-label="Role" [value]="roleFilter()" (change)="roleFilter.set($any($event.target).value)">
            <option value="">All roles</option>
            @for (r of roles; track r) { <option [value]="r">{{ r }}</option> }
          </select>
        </div>
      </header>

      @if (canManage()) {
        <section class="grid gap-4 print:hidden lg:grid-cols-2">
          <div class="space-y-2 rounded-2xl border bg-white p-5 dark:bg-neutral-800">
            <h2 class="font-semibold">Add an existing account</h2>
            <div class="flex flex-wrap gap-2">
              <input class="min-w-40 flex-1 rounded-lg border px-3 py-2 dark:bg-neutral-900" dir="ltr" placeholder="Username" [value]="newUserName()" (input)="newUserName.set($any($event.target).value)" />
              <select class="rounded-lg border px-3 py-2 dark:bg-neutral-900" aria-label="Role" [value]="newRole()" (change)="newRole.set($any($event.target).value)">
                @for (r of roles; track r) { <option [value]="r">{{ r }}</option> }
              </select>
              <button matButton="outlined" [disabled]="!newUserName().trim()" (click)="add()">Add</button>
            </div>
            @if (addError()) { <p class="text-sm text-red-600">{{ addError() }}</p> }
          </div>
          <div class="space-y-2 rounded-2xl border bg-white p-5 dark:bg-neutral-800">
            <h2 class="font-semibold">Import from Excel</h2>
            <p class="text-sm text-neutral-500">Creates accounts with usernames and temporary passwords to print.</p>
            <div class="flex flex-wrap items-center gap-2">
              <button matButton (click)="downloadTemplate()">Download template</button>
              <label class="cursor-pointer rounded-lg border px-3 py-2 text-sm">
                Upload .xlsx
                <input type="file" class="hidden" accept=".xlsx" (change)="upload($any($event.target))" />
              </label>
            </div>
            @if (importError()) { <p class="text-sm text-red-600">{{ importError() }}</p> }
          </div>
        </section>
      }

      @if (report(); as r) {
        <section class="space-y-3 rounded-2xl border bg-white p-5 dark:bg-neutral-800">
          <div class="flex items-center justify-between print:hidden">
            <h2 class="font-semibold">Import: {{ r.created }} created, {{ r.failed }} failed</h2>
            <div class="flex gap-2">
              <button matButton (click)="print()"><mat-icon svgIcon="printer" /> Print credentials</button>
              <button matButton (click)="report.set(null)">Close</button>
            </div>
          </div>
          <p class="text-sm text-amber-700 print:hidden">Temporary passwords are shown only now. Print or hand them out before closing.</p>
          <table class="w-full text-sm">
            <thead><tr class="text-left text-neutral-500"><th class="p-1">#</th><th class="p-1">Name</th><th class="p-1">Role</th><th class="p-1">Username</th><th class="p-1">Temporary password</th></tr></thead>
            <tbody>
              @for (row of r.rows; track row.rowNumber) {
                <tr class="border-t" [class.text-red-600]="row.status === 'Failed'">
                  <td class="p-1">{{ row.rowNumber }}</td>
                  <td class="p-1">{{ row.fullName }}</td>
                  <td class="p-1">{{ row.role }}</td>
                  @if (row.status === 'Created') {
                    <td class="p-1 font-mono" dir="ltr">{{ row.userName }}</td><td class="p-1 font-mono" dir="ltr">{{ row.temporaryPassword }}</td>
                  } @else {
                    <td class="p-1" colspan="2">{{ row.errors.join(' ') }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </section>
      }

      <section class="divide-y rounded-2xl border bg-white print:hidden dark:bg-neutral-800">
        @for (m of filtered(); track m.userId) {
          <div class="p-4">
            <div class="flex flex-wrap items-center gap-3">
              <div class="min-w-0 flex-1">
                <p class="font-medium">{{ m.fullName || m.userName }}</p>
                <p class="text-xs text-neutral-500"><span dir="ltr">{{ m.userName }}</span> · {{ m.roles.join(', ') }} · {{ m.status }} · joined {{ m.joinedAtUtc | orgDate }}</p>
              </div>
              @if (canManage()) {
                <select class="rounded-lg border px-2 py-1 text-sm dark:bg-neutral-900" aria-label="Gender" [value]="m.gender ?? ''" (change)="setGender(m, $any($event.target).value || null)">
                  <option value="">Gender —</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              } @else if (m.gender) {
                <span class="text-sm text-neutral-500">{{ m.gender }}</span>
              }
              @if (m.roles.includes('Student')) {
                <button matButton (click)="toggleParents(m)">Parents</button>
              }
            </div>

            @if (openStudent() === m.userId) {
              <div class="mt-3 space-y-2 rounded-lg bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
                @for (p of parents(); track p.userId) {
                  <div class="flex items-center justify-between gap-2">
                    <span>{{ p.fullName || p.userName }} <span class="text-neutral-500" dir="ltr">{{ p.userName }}{{ p.phoneNumber ? ' · ' + p.phoneNumber : '' }}</span></span>
                    @if (canManage()) {
                      <button matIconButton aria-label="Unlink parent" (click)="unlink(m, p)"><mat-icon svgIcon="x" /></button>
                    }
                  </div>
                } @empty {
                  <p class="text-neutral-500">No parent linked yet.</p>
                }
                @if (canManage() && parents().length < 2) {
                  <div class="flex flex-wrap gap-2">
                    <input class="min-w-40 flex-1 rounded-lg border px-3 py-1.5 dark:bg-neutral-800" dir="ltr" placeholder="Parent's username" [value]="parentUserName()" (input)="parentUserName.set($any($event.target).value)" />
                    <button matButton="outlined" [disabled]="!parentUserName().trim()" (click)="link(m)">Link</button>
                    <button matButton (click)="invite(m)"><mat-icon svgIcon="qr-code" /> Code for the family</button>
                  </div>
                }
                @if (inviteCode(); as code) {
                  <div class="rounded-lg border border-dashed p-3">
                    <p>Give this code to {{ code.childName }}'s parent. They sign up as a parent and enter it under "My children".</p>
                    <p class="mt-1 font-mono text-2xl tracking-widest" dir="ltr">{{ code.code }}</p>
                    <p class="text-xs text-neutral-500">Valid until {{ code.expiresAtUtc | orgDate }}. One use.</p>
                  </div>
                }
                @if (parentError()) { <p class="text-red-600">{{ parentError() }}</p> }
              </div>
            }
          </div>
        } @empty {
          <p class="p-6 text-center text-sm text-neutral-500">No members match.</p>
        }
      </section>
    </div>
  `,
})
export default class MembersComponent {
  protected orgContext = inject(OrgContextService);
  private school = inject(SchoolService);

  protected readonly roles = ROLES;
  protected canManage = computed(() => this.orgContext.can('members.manage'));
  protected members = signal<Member[]>([]);
  protected search = signal('');
  protected roleFilter = signal('');
  protected filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const role = this.roleFilter();
    return this.members().filter(m =>
      (!role || m.roles.includes(role)) && (!q || m.fullName.toLowerCase().includes(q) || m.userName.toLowerCase().includes(q)));
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

  protected add(): void {
    this.addError.set(null);
    this.school.addMember(this.org, this.newUserName().trim(), [this.newRole()]).subscribe({
      next: () => {
        this.newUserName.set('');
        this.load();
      },
      error: (err: unknown) => this.addError.set(errorMessages(err, 'The member could not be added.').join(' ')),
    });
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
      error: (err: unknown) => this.importError.set(errorMessages(err, 'The file could not be imported.').join(' ')),
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
      error: (err: unknown) => this.parentError.set(errorMessages(err, 'The parent could not be linked.').join(' ')),
    });
  }

  protected unlink(student: Member, parent: ParentLink): void {
    this.school.unlinkParent(this.org, student.userId, parent.userId).subscribe(() => this.loadParents(student));
  }

  protected invite(student: Member): void {
    this.parentError.set(null);
    this.school.parentInvite(this.org, student.userId).subscribe({
      next: code => this.inviteCode.set(code),
      error: (err: unknown) => this.parentError.set(errorMessages(err, 'A code could not be created.').join(' ')),
    });
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
