import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoDirective } from '@jsverse/transloco';

import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { Branch, ClassInput, ClassSummary, Member, SchoolService, WeeklySlot } from '@/app/core/school/school.service';
import { CurriculumDto, LookupDto, LookupsService } from '@/app/core/services/lookups.service';
import { I18nService } from '@/app/core/transloco/i18n.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';

export const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Create or edit a class (school section) or group (center), including a weekly schedule for groups. */
@Component({
  selector: 'class-form',
  imports: [MatIconModule, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      @let f = form();
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label class="field">
          <span class="field-label">{{ t('classes.form.name') }}</span>
          <input class="input" maxlength="100" [placeholder]="t('classes.form.namePlaceholder')" [value]="f.name" (input)="patch({ name: $any($event.target).value })" />
        </label>
        <label class="field">
          <span class="field-label">{{ t('classes.form.kind') }}</span>
          <select class="select" [value]="f.kind" (change)="patch({ kind: $any($event.target).value })">
            <option value="Section">{{ t('classes.form.kindSection') }}</option>
            <option value="Group">{{ t('classes.form.kindGroup') }}</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">{{ t('classes.form.gender') }}</span>
          <select class="select" [value]="f.gender" (change)="patch({ gender: $any($event.target).value })">
            <option value="Mixed">{{ t('gender.Mixed') }}</option>
            <option value="Boys">{{ t('gender.Boys') }}</option>
            <option value="Girls">{{ t('gender.Girls') }}</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">{{ t('classes.form.branch') }}</span>
          <select class="select" [value]="f.branchId ?? ''" (change)="patch({ branchId: $any($event.target).value || null })">
            <option value="">{{ t('classes.form.none') }}</option>
            @for (b of branches(); track b.id) {
              <option [value]="b.id" [selected]="b.id === f.branchId">{{ b.name }}{{ b.gender !== 'Mixed' ? ' · ' + t('gender.' + b.gender) : '' }}</option>
            }
          </select>
        </label>
        <label class="field">
          <span class="field-label">{{ t('classes.form.curriculum') }}</span>
          <select class="select" [value]="f.curriculumId ?? ''" (change)="selectCurriculum($any($event.target).value)">
            <option value="">{{ t('classes.form.none') }}</option>
            @for (c of curricula(); track c.id) { <option [value]="c.id" [selected]="c.id === f.curriculumId">{{ name(c) }}</option> }
          </select>
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="field">
            <span class="field-label">{{ t('classes.form.stage') }}</span>
            <select class="select" [value]="stageId() ?? ''" (change)="selectStage($any($event.target).value)" [disabled]="!stages().length">
              <option value="">{{ t('classes.form.none') }}</option>
              @for (s of stages(); track s.id) { <option [value]="s.id">{{ name(s) }}</option> }
            </select>
          </label>
          <label class="field">
            <span class="field-label">{{ t('classes.form.grade') }}</span>
            <select class="select" [value]="f.gradeId ?? ''" (change)="patch({ gradeId: +$any($event.target).value || null })" [disabled]="!grades().length">
              <option value="">{{ t('classes.form.none') }}</option>
              @for (g of grades(); track g.id) { <option [value]="g.id" [selected]="g.id === f.gradeId">{{ name(g) }}</option> }
            </select>
          </label>
        </div>
        <label class="field">
          <span class="field-label">{{ t('classes.form.homeroom') }}</span>
          <select class="select" [value]="f.homeroomTeacherUserId ?? ''" (change)="patch({ homeroomTeacherUserId: $any($event.target).value || null })">
            <option value="">{{ t('classes.form.none') }}</option>
            @for (m of teachers(); track m.userId) { <option [value]="m.userId" [selected]="m.userId === f.homeroomTeacherUserId">{{ m.fullName || m.userName }}</option> }
          </select>
        </label>
        <label class="field">
          <span class="field-label">{{ t('classes.form.capacity') }}</span>
          <input class="input" type="number" min="1" inputmode="numeric" [value]="f.capacity ?? ''" (input)="patch({ capacity: +$any($event.target).value || null })" />
        </label>
      </div>

      @if (f.kind === 'Group') {
        <fieldset class="mt-5 flex flex-col gap-2">
          <legend class="field-label mb-2">{{ t('classes.form.schedule') }}</legend>
          @for (slot of f.schedule; track $index; let i = $index) {
            <div class="flex flex-wrap items-center gap-2">
              <select class="select w-auto min-w-36" [attr.aria-label]="t('classes.form.schedule')" [value]="slot.day" (change)="patchSlot(i, { day: $any($event.target).value })">
                @for (d of days; track d) { <option [value]="d">{{ t('day.' + d) }}</option> }
              </select>
              <input type="time" class="input w-auto" [value]="slot.startTime" (input)="patchSlot(i, { startTime: $any($event.target).value })" />
              <span aria-hidden="true">–</span>
              <input type="time" class="input w-auto" [value]="slot.endTime" (input)="patchSlot(i, { endTime: $any($event.target).value })" />
              <button type="button" class="btn-icon" [attr.aria-label]="t('classes.form.removeMeeting')" (click)="removeSlot(i)"><mat-icon svgIcon="x" class="icon-size-5" /></button>
            </div>
          }
          <button type="button" class="btn btn-ghost btn-sm self-start" (click)="addSlot()"><mat-icon svgIcon="plus" class="icon-size-4" />{{ t('classes.form.addMeeting') }}</button>
        </fieldset>
      }

      @if (errors().length) {
        <div class="alert alert-danger mt-4" role="alert"><ul class="list-inside list-disc">@for (e of errors(); track $index) { <li>{{ e }}</li> }</ul></div>
      }
      <div class="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" class="btn btn-ghost" (click)="cancelled.emit()">{{ t('action.cancel') }}</button>
        <button type="button" class="btn btn-primary" [disabled]="saving() || !f.name.trim()" (click)="save()">{{ t('action.save') }}</button>
      </div>
    </ng-container>
  `,
})
export class ClassForm implements OnInit {
  private school = inject(SchoolService);
  private lookups = inject(LookupsService);
  private orgContext = inject(OrgContextService);
  private i18n = inject(I18nService);

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
      this.form.set({ ...input, schedule: input.schedule.map(s => ({ ...s, startTime: s.startTime.slice(0, 5), endTime: s.endTime.slice(0, 5) })) });
    } else if (org.type === 'Center') {
      this.patch({ kind: 'Group' });
    }

    this.school.branches(org.slug).subscribe(b => this.branches.set(b));
    this.school.members(org.slug).subscribe(m => this.members.set(m));
    this.lookups.getCurricula(org.countryCode).subscribe(c => this.curricula.set(c));
    if (existing?.curriculumId) this.lookups.getEducationStages(existing.curriculumId).subscribe(s => this.stages.set(s));
  }

  protected name(item: LookupDto): string {
    return this.i18n.lang() === 'ar' ? item.nameAr || item.nameEn : item.nameEn || item.nameAr;
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
        this.errors.set(errorMessages(err, 'Error'));
      },
    });
  }
}
