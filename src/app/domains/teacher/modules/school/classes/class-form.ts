import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { Branch, ClassInput, ClassSummary, Member, SchoolService, WeeklySlot } from '@/app/core/school/school.service';
import { CurriculumDto, LookupDto, LookupsService } from '@/app/core/services/lookups.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';

export const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Create or edit a class (school section) or group (center), including a weekly schedule for groups. */
@Component({
  selector: 'class-form',
  imports: [MatButtonModule, MatIconModule],
  template: `
    @let f = form();
    <div class="grid gap-4 sm:grid-cols-2">
      <label class="block">
        <span class="text-sm font-medium">Name</span>
        <input class="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-neutral-900" maxlength="100" placeholder="e.g. 7-B"
               [value]="f.name" (input)="patch({ name: $any($event.target).value })" />
      </label>
      <label class="block">
        <span class="text-sm font-medium">Type</span>
        <select class="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-neutral-900" [value]="f.kind" (change)="patch({ kind: $any($event.target).value })">
          <option value="Section">Class / section (school)</option>
          <option value="Group">Group with schedule (center)</option>
        </select>
      </label>
      <label class="block">
        <span class="text-sm font-medium">For</span>
        <select class="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-neutral-900" [value]="f.gender" (change)="patch({ gender: $any($event.target).value })">
          <option value="Mixed">Boys and girls</option>
          <option value="Boys">Boys</option>
          <option value="Girls">Girls</option>
        </select>
      </label>
      <label class="block">
        <span class="text-sm font-medium">Branch / campus</span>
        <select class="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-neutral-900" [value]="f.branchId ?? ''" (change)="patch({ branchId: $any($event.target).value || null })">
          <option value="">—</option>
          @for (b of branches(); track b.id) {
            <option [value]="b.id">{{ b.name }}{{ b.gender !== 'Mixed' ? ' (' + b.gender + ')' : '' }}</option>
          }
        </select>
      </label>
      <label class="block">
        <span class="text-sm font-medium">Curriculum</span>
        <select class="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-neutral-900" [value]="f.curriculumId ?? ''" (change)="selectCurriculum($any($event.target).value)">
          <option value="">—</option>
          @for (c of curricula(); track c.id) { <option [value]="c.id">{{ c.nameEn }}</option> }
        </select>
      </label>
      <div class="grid grid-cols-2 gap-2">
        <label class="block">
          <span class="text-sm font-medium">Stage</span>
          <select class="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-neutral-900" [value]="stageId() ?? ''" (change)="selectStage($any($event.target).value)" [disabled]="!stages().length">
            <option value="">—</option>
            @for (s of stages(); track s.id) { <option [value]="s.id">{{ s.nameEn }}</option> }
          </select>
        </label>
        <label class="block">
          <span class="text-sm font-medium">Grade</span>
          <select class="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-neutral-900" [value]="f.gradeId ?? ''" (change)="patch({ gradeId: +$any($event.target).value || null })" [disabled]="!grades().length">
            <option value="">—</option>
            @for (g of grades(); track g.id) { <option [value]="g.id">{{ g.nameEn }}</option> }
          </select>
        </label>
      </div>
      <label class="block">
        <span class="text-sm font-medium">Homeroom teacher</span>
        <select class="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-neutral-900" [value]="f.homeroomTeacherUserId ?? ''" (change)="patch({ homeroomTeacherUserId: $any($event.target).value || null })">
          <option value="">—</option>
          @for (t of teachers(); track t.userId) { <option [value]="t.userId">{{ t.fullName || t.userName }}</option> }
        </select>
      </label>
      <label class="block">
        <span class="text-sm font-medium">Capacity (optional)</span>
        <input type="number" min="1" class="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-neutral-900"
               [value]="f.capacity ?? ''" (input)="patch({ capacity: +$any($event.target).value || null })" />
      </label>
    </div>

    @if (f.kind === 'Group') {
      <div class="mt-4 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">Weekly schedule</span>
          <button matButton type="button" (click)="addSlot()"><mat-icon svgIcon="plus" /> Add meeting</button>
        </div>
        @for (slot of f.schedule; track $index; let i = $index) {
          <div class="flex flex-wrap items-center gap-2">
            <select class="rounded-lg border px-2 py-1 dark:bg-neutral-900" [value]="slot.day" (change)="patchSlot(i, { day: $any($event.target).value })">
              @for (d of days; track d) { <option [value]="d">{{ d }}</option> }
            </select>
            <input type="time" class="rounded-lg border px-2 py-1 dark:bg-neutral-900" [value]="slot.startTime" (input)="patchSlot(i, { startTime: $any($event.target).value })" />
            <span>–</span>
            <input type="time" class="rounded-lg border px-2 py-1 dark:bg-neutral-900" [value]="slot.endTime" (input)="patchSlot(i, { endTime: $any($event.target).value })" />
            <button matIconButton type="button" aria-label="Remove meeting" (click)="removeSlot(i)"><mat-icon svgIcon="x" /></button>
          </div>
        }
      </div>
    }

    @if (errors().length) {
      <ul class="mt-4 list-inside list-disc rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30">
        @for (e of errors(); track $index) { <li>{{ e }}</li> }
      </ul>
    }
    <div class="mt-4 flex justify-end gap-2">
      <button matButton type="button" (click)="cancelled.emit()">Cancel</button>
      <button matButton="filled" type="button" [disabled]="saving() || !f.name.trim()" (click)="save()">Save</button>
    </div>
  `,
})
export class ClassForm implements OnInit {
  private school = inject(SchoolService);
  private lookups = inject(LookupsService);
  private orgContext = inject(OrgContextService);

  /** The class to edit, or null to create one. */
  readonly value = input<ClassSummary | null>(null);
  readonly saved = output<ClassSummary>();
  readonly cancelled = output<void>();

  protected readonly days = WEEK_DAYS;
  protected form = signal<ClassInput>({
    name: '', kind: 'Section', gender: 'Mixed', branchId: null, curriculumId: null, gradeId: null,
    homeroomTeacherUserId: null, capacity: null, schedule: [],
  });
  protected branches = signal<Branch[]>([]);
  protected members = signal<Member[]>([]);
  protected curricula = signal<CurriculumDto[]>([]);
  protected stages = signal<LookupDto[]>([]);
  protected grades = signal<LookupDto[]>([]);
  protected stageId = signal<number | null>(null);
  protected saving = signal(false);
  protected errors = signal<string[]>([]);

  protected teachers = computed(() => this.members().filter(m => m.roles.includes('Teacher') && m.status === 'Active'));

  ngOnInit(): void {
    const org = this.orgContext.activeOrg()!;
    const existing = this.value();
    if (existing) {
      const { id, branchName, homeroomTeacherName, studentCount, ...input } = existing;
      this.form.set(input);
    } else if (org.type === 'Center') {
      this.patch({ kind: 'Group' });
    }

    this.school.branches(org.slug).subscribe(b => this.branches.set(b));
    this.school.members(org.slug).subscribe(m => this.members.set(m));
    this.lookups.getCurricula(org.countryCode).subscribe(c => this.curricula.set(c));
    if (existing?.curriculumId) this.lookups.getEducationStages(existing.curriculumId).subscribe(s => this.stages.set(s));
  }

  protected patch(changes: Partial<ClassInput>): void {
    this.form.update(f => ({ ...f, ...changes }));
  }

  protected selectCurriculum(value: string): void {
    const curriculumId = +value || null;
    this.patch({ curriculumId, gradeId: null });
    this.stageId.set(null);
    this.grades.set([]);
    this.stages.set([]);
    if (curriculumId) this.lookups.getEducationStages(curriculumId).subscribe(s => this.stages.set(s));
  }

  protected selectStage(value: string): void {
    const stageId = +value || null;
    this.stageId.set(stageId);
    this.patch({ gradeId: null });
    this.grades.set([]);
    if (stageId) this.lookups.getEducationGrades(stageId).subscribe(g => this.grades.set(g));
  }

  protected addSlot(): void {
    const slot: WeeklySlot = { day: 'Sunday', startTime: '16:00', endTime: '17:30' };
    this.patch({ schedule: [...this.form().schedule, slot] });
  }

  protected patchSlot(index: number, changes: Partial<WeeklySlot>): void {
    this.patch({ schedule: this.form().schedule.map((s, i) => (i === index ? { ...s, ...changes } : s)) });
  }

  protected removeSlot(index: number): void {
    this.patch({ schedule: this.form().schedule.filter((_, i) => i !== index) });
  }

  protected save(): void {
    this.saving.set(true);
    this.errors.set([]);
    const f = this.form();
    const input: ClassInput = { ...f, name: f.name.trim(), schedule: f.kind === 'Group' ? f.schedule : [] };
    this.school.saveClass(this.orgContext.requireActiveSlug(), this.value()?.id ?? null, input).subscribe({
      next: saved => {
        this.saving.set(false);
        this.saved.emit(saved);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.errors.set(errorMessages(err, 'The class could not be saved.'));
      },
    });
  }
}
