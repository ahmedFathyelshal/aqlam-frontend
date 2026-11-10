import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { todayIn } from '@/app/core/organizations/org-date';
import { AcademicsService, AcademicYear, defaultTerm, Gradebook, GradeCategory, GradeItem, GradeRow, saveBlob } from '@/app/core/school/academics.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';
import { ConfirmService } from '@/app/shared/ui/confirm.service';

type CategoryDraft = { id: string | null; name: string; weight: number | null };
type ItemDraft = { categoryId: string; id: string | null; title: string; maxPoints: number | null; lessonId: string | null };

/**
 * Gradebook of one subject in one class and term.
 * Laptop and tablet: a grid with a sticky student column. Phone: pick one assessment and enter scores down a list.
 */
@Component({
  selector: 'app-gradebook',
  imports: [MatIconModule, RouterLink, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <div class="page">
        <a class="back-link" [routerLink]="orgContext.path('classes', classId)"><mat-icon svgIcon="chevron-right" class="icon-size-4 ltr:rotate-180" />{{ book()?.className ?? t('classes.title') }}</a>
        <header class="page-header">
          <div>
            <h1 class="page-title">{{ book()?.subjectName ?? t('gradebook.title') }}</h1>
            <p class="page-subtitle">{{ t('gradebook.title') }}@if (book(); as b) { · {{ b.className }} }</p>
          </div>
          @if (years()?.length) {
            <div class="flex w-full flex-wrap items-end gap-2 sm:w-auto">
              <label class="field min-w-0 flex-1 sm:w-56 sm:flex-none">
                <span class="field-label">{{ t('gradebook.term') }}</span>
                <select class="select" (change)="selectTerm($any($event.target).value)">
                  @for (y of years(); track y.id) {
                    <optgroup [label]="y.name">
                      @for (term of y.terms; track term.id) { <option [value]="term.id" [selected]="term.id === termId()">{{ term.name }}</option> }
                    </optgroup>
                  }
                </select>
              </label>
              <button type="button" class="btn btn-secondary" [disabled]="!book()" (click)="exportExcel()"><mat-icon svgIcon="file-spreadsheet" class="icon-size-5" />{{ t('gradebook.export') }}</button>
            </div>
          }
        </header>

        @if (error()) { <div class="alert alert-danger mb-4" role="alert">{{ error() }}</div> }

        @if (years(); as list) {
          @if (!list.length || !termId()) {
            <div class="empty">
              <p>{{ canManage() ? t('gradebook.noYear') : t('gradebook.noYearStaff') }}</p>
              @if (canManage()) { <a class="btn btn-primary mt-3" [routerLink]="orgContext.path('academic-years')">{{ t('gradebook.manageYears') }}</a> }
            </div>
          }
        }

        @if (book(); as b) {
          @if (b.categories.length && b.weightsTotal !== 100) {
            <div class="alert alert-warning mb-4" role="status">{{ t('gradebook.weights', { total: b.weightsTotal }) }}</div>
          }

          @if (!items().length) {
            <div class="empty mb-5">{{ t('gradebook.noItems') }}</div>
          } @else if (!b.students.length) {
            <div class="empty mb-5">{{ t('gradebook.noStudents') }}</div>
          } @else {
            <!-- Grid: tablet and laptop -->
            <div class="table-wrap mb-2 hidden max-h-[calc(100dvh-14rem)] overflow-auto sm:block">
              <table class="table [&_td]:px-2 [&_th]:px-2">
                <thead class="sticky top-0 z-20 [&_th]:bg-page">
                  <tr>
                    <th rowspan="2" class="sticky start-0 z-30 min-w-40 border-e border-line">{{ t('gradebook.student') }}</th>
                    @for (c of b.categories; track c.id) {
                      <th class="border-s border-line-soft text-center" [attr.colspan]="c.items.length + 1">{{ c.name }} <span class="font-normal text-muted" dir="ltr">{{ c.weightPercent }}%</span></th>
                    }
                    <th rowspan="2" class="border-s border-line text-center">{{ t('gradebook.final') }}</th>
                    @if (b.scale !== 'Percent') { <th rowspan="2" class="text-center">{{ t('gradebook.label') }}</th> }
                  </tr>
                  <tr>
                    @for (c of b.categories; track c.id) {
                      @for (i of c.items; track i.id; let first = $first) {
                        <th class="min-w-20 text-center font-medium" [class.border-s]="first" [class.border-line-soft]="first">
                          {{ i.title }}
                          <span class="block text-xs font-normal text-muted" dir="ltr">/ {{ i.maxPoints }}</span>
                        </th>
                      }
                      <th class="text-center font-medium text-muted" [class.border-s]="!c.items.length" [class.border-line-soft]="!c.items.length" dir="ltr">%</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (s of b.students; track s.userId; let row = $index) {
                    <tr class="hover:[&_td]:bg-neutral-50">
                      <th scope="row" class="sticky start-0 z-10 border-e border-line bg-white font-bold">
                        <a [routerLink]="orgContext.path('report-cards', s.userId, termId()!)" [attr.title]="t('gradebook.reportCard')">{{ s.fullName || s.userName }}</a>
                      </th>
                      @for (c of b.categories; track c.id) {
                        @for (i of c.items; track i.id; let first = $first) {
                          <td class="text-center" [class.border-s]="first" [class.border-line-soft]="first">
                            <input
                              class="input mx-auto min-h-11 w-16 border-transparent bg-transparent px-1 text-center tabular-nums hover:border-line focus:border-secondary-600 focus:bg-white"
                              [class.bg-secondary-100]="isLinked(s, i)"
                              [attr.data-grade-col]="i.id" [attr.data-grade-row]="row"
                              (keydown.enter)="$event.preventDefault(); moveDown(i.id, row)"
                              type="number" inputmode="decimal" min="0" dir="ltr" step="any"
                              [max]="i.maxPoints"
                              [attr.aria-label]="(s.fullName || s.userName) + ': ' + i.title"
                              [value]="scoreOf(s, i) ?? ''"
                              (change)="saveScore(s, i, $any($event.target))"
                            />
                          </td>
                        }
                        <td class="text-center text-muted" [class.border-s]="!c.items.length" [class.border-line-soft]="!c.items.length" dir="ltr">{{ s.categoryPercents[c.id] ?? '–' }}</td>
                      }
                      <td class="border-s border-line bg-page text-center font-bold tabular-nums text-ink" dir="ltr">{{ s.finalPercent ?? '–' }}</td>
                      @if (b.scale !== 'Percent') { <td class="text-center">{{ s.label ? t('grade.' + s.label) : '–' }}</td> }
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- One assessment at a time: phone -->
            <section class="card mb-2 sm:hidden">
              <div class="border-b border-line-soft p-4">
                <label class="field">
                  <span class="field-label">{{ t('gradebook.chooseItem') }}</span>
                  <select class="select" (change)="phoneItemId.set($any($event.target).value)">
                    @for (c of b.categories; track c.id) {
                      <optgroup [label]="c.name">
                        @for (i of c.items; track i.id) { <option [value]="i.id" [selected]="i.id === phoneItem()?.id">{{ i.title }} (/{{ i.maxPoints }})</option> }
                      </optgroup>
                    }
                  </select>
                </label>
              </div>
              @if (phoneItem(); as i) {
                @for (s of b.students; track s.userId) {
                  <div class="list-row">
                    <div class="min-w-0 flex-1">
                      <a class="block truncate font-bold" [routerLink]="orgContext.path('report-cards', s.userId, termId()!)">{{ s.fullName || s.userName }}</a>
                      <p class="text-sm text-muted">
                        {{ t('gradebook.final') }}: <span dir="ltr">{{ s.finalPercent ?? '–' }}</span>
                        @if (s.label) { · {{ t('grade.' + s.label) }} }
                      </p>
                    </div>
                    <input
                      class="input w-20 text-center"
                      [class.bg-secondary-100]="isLinked(s, i)"
                      type="number" inputmode="decimal" min="0" dir="ltr" step="any"
                      [max]="i.maxPoints"
                      [attr.aria-label]="(s.fullName || s.userName) + ': ' + i.title"
                      [value]="scoreOf(s, i) ?? ''"
                      (change)="saveScore(s, i, $any($event.target))"
                    />
                  </div>
                }
              }
            </section>

            <div class="mb-5 flex flex-wrap items-center justify-between gap-2">
              @if (hasLinked()) { <p class="field-hint">{{ t('gradebook.linkedHint') }}</p> }
              <span class="text-sm font-bold text-primary-700" role="status">{{ saved() ? t('gradebook.saved') : '' }}</span>
            </div>
          }

          <!-- Categories and assessments -->
          <section class="card">
            <div class="card-header flex-wrap gap-2">
              <h2 class="section-title">{{ t('gradebook.setup') }}</h2>
              <button type="button" class="btn btn-secondary btn-sm" (click)="newCategory()"><mat-icon svgIcon="plus" class="icon-size-4" />{{ t('gradebook.addCategory') }}</button>
            </div>

            @if (categoryDraft(); as d) {
              <div class="border-b border-line-soft p-4 sm:px-5">
                <div class="grid gap-3 sm:grid-cols-[1fr_9rem]">
                  <label class="field">
                    <span class="field-label">{{ t('gradebook.categoryName') }}</span>
                    <input class="input" maxlength="100" [placeholder]="t('gradebook.categoryPlaceholder')" [value]="d.name" (input)="patchCategory({ name: $any($event.target).value })" />
                  </label>
                  <label class="field">
                    <span class="field-label">{{ t('gradebook.weight') }}</span>
                    <input class="input" type="number" min="1" max="100" inputmode="decimal" dir="ltr" [value]="d.weight ?? ''" (input)="patchCategory({ weight: +$any($event.target).value || null })" />
                  </label>
                </div>
                <div class="mt-3 flex justify-end gap-2">
                  <button type="button" class="btn btn-ghost btn-sm" (click)="categoryDraft.set(null)">{{ t('action.cancel') }}</button>
                  <button type="button" class="btn btn-primary btn-sm" [disabled]="!d.name.trim() || !d.weight" (click)="saveCategory()">{{ t('action.save') }}</button>
                </div>
              </div>
            }

            @for (c of b.categories; track c.id) {
              <div class="border-b border-line-soft p-4 last:border-b-0 sm:px-5">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="min-w-0 basis-full font-extrabold sm:flex-1 sm:basis-0">{{ c.name }} <span class="badge badge-info ms-1" dir="ltr">{{ c.weightPercent }}%</span></h3>
                  <button type="button" class="btn btn-ghost btn-sm" (click)="newItem(c)"><mat-icon svgIcon="plus" class="icon-size-4" />{{ t('gradebook.addItem') }}</button>
                  <button type="button" class="btn-icon" [attr.aria-label]="t('gradebook.edit') + ': ' + c.name" (click)="editCategory(c)"><mat-icon svgIcon="pencil" class="icon-size-5" /></button>
                  <button type="button" class="btn-icon" [attr.aria-label]="t('gradebook.deleteCategory') + ': ' + c.name" (click)="deleteCategory(c)"><mat-icon svgIcon="trash-2" class="icon-size-5" /></button>
                </div>

                @if (itemDraft()?.categoryId === c.id) {
                  @if (itemDraft(); as d) {
                    <div class="mt-3 rounded-ui border border-line-soft p-3">
                      <div class="grid gap-3 sm:grid-cols-[1fr_9rem]">
                        <label class="field">
                          <span class="field-label">{{ t('gradebook.itemTitle') }}</span>
                          <input class="input" maxlength="200" [placeholder]="t('gradebook.itemPlaceholder')" [value]="d.title" (input)="patchItem({ title: $any($event.target).value })" />
                        </label>
                        <label class="field">
                          <span class="field-label">{{ t('gradebook.maxPoints') }}</span>
                          <input class="input" type="number" min="1" max="1000" inputmode="decimal" dir="ltr" [value]="d.maxPoints ?? ''" (input)="patchItem({ maxPoints: +$any($event.target).value || null })" />
                        </label>
                      </div>
                      @if (b.linkableLessons.length) {
                        <label class="field mt-3">
                          <span class="field-label">{{ t('gradebook.link') }}</span>
                          <select class="select" (change)="patchItem({ lessonId: $any($event.target).value || null })">
                            <option value="" [selected]="!d.lessonId">{{ t('gradebook.noLink') }}</option>
                            @for (l of b.linkableLessons; track l.lessonId) {
                              <option [value]="l.lessonId" [selected]="l.lessonId === d.lessonId">{{ l.title }} · {{ l.type === 'Quiz' ? t('gradebook.quiz') : t('gradebook.assignment') }}</option>
                            }
                          </select>
                        </label>
                      }
                      <div class="mt-3 flex justify-end gap-2">
                        <button type="button" class="btn btn-ghost btn-sm" (click)="itemDraft.set(null)">{{ t('action.cancel') }}</button>
                        <button type="button" class="btn btn-primary btn-sm" [disabled]="!d.title.trim() || !d.maxPoints" (click)="saveItem()">{{ t('action.save') }}</button>
                      </div>
                    </div>
                  }
                }

                @if (c.items.length) {
                  <ul class="mt-2">
                    @for (i of c.items; track i.id) {
                      <li class="flex items-center gap-2 border-t border-line-soft py-1.5 text-[0.95rem] first:border-t-0">
                        <span class="min-w-0 flex-1 truncate">{{ i.title }} <span class="text-sm text-muted" dir="ltr">/ {{ i.maxPoints }}</span></span>
                        @if (i.source !== 'Manual') { <span class="badge badge-neutral">{{ t('gradebook.linked') }}: {{ i.source === 'Quiz' ? t('gradebook.quiz') : t('gradebook.assignment') }}</span> }
                        <button type="button" class="btn-icon" [attr.aria-label]="t('gradebook.edit') + ': ' + i.title" (click)="editItem(c, i)"><mat-icon svgIcon="pencil" class="icon-size-4" /></button>
                        <button type="button" class="btn-icon" [attr.aria-label]="t('gradebook.deleteItem') + ': ' + i.title" (click)="deleteItem(i)"><mat-icon svgIcon="trash-2" class="icon-size-4" /></button>
                      </li>
                    }
                  </ul>
                }
              </div>
            }
          </section>
        }
      </div>
    </ng-container>
  `,
})
export default class GradebookComponent {
  private confirmer = inject(ConfirmService);
  protected orgContext = inject(OrgContextService);
  private academics = inject(AcademicsService);
  private transloco = inject(TranslocoService);
  private route = inject(ActivatedRoute);

  protected classId = this.route.snapshot.paramMap.get('classId')!;
  private assignmentId = this.route.snapshot.paramMap.get('assignmentId')!;

  protected years = signal<AcademicYear[] | null>(null);
  protected termId = signal<string | null>(null);
  protected book = signal<Gradebook | null>(null);
  protected error = signal<string | null>(null);
  protected saved = signal(false);
  protected phoneItemId = signal<string | null>(null);
  protected categoryDraft = signal<CategoryDraft | null>(null);
  protected itemDraft = signal<ItemDraft | null>(null);

  protected canManage = computed(() => this.orgContext.can('classes.manage'));
  protected items = computed(() => (this.book()?.categories ?? []).flatMap(c => c.items));
  protected phoneItem = computed<GradeItem | null>(() => this.items().find(i => i.id === this.phoneItemId()) ?? this.items()[0] ?? null);
  protected hasLinked = computed(() => this.items().some(i => i.source !== 'Manual'));

  constructor() {
    this.academics.years(this.org).subscribe({
      next: years => {
        this.years.set(years);
        const term = defaultTerm(years, todayIn(this.orgContext.activeOrg()?.timeZone));
        this.termId.set(term?.id ?? null);
        if (term) this.load();
      },
      error: err => this.fail(err),
    });
  }

  protected selectTerm(termId: string): void {
    this.termId.set(termId);
    this.book.set(null);
    this.phoneItemId.set(null);
    this.categoryDraft.set(null);
    this.itemDraft.set(null);
    this.load();
  }

  protected scoreOf(row: GradeRow, item: GradeItem): number | null {
    return row.cells.find(c => c.itemId === item.id)?.score ?? null;
  }

  protected isLinked(row: GradeRow, item: GradeItem): boolean {
    return !!row.cells.find(c => c.itemId === item.id)?.fromLesson;
  }

  /** Saves one score when the cell changes. Clearing a linked cell goes back to the lesson's score. */
  protected saveScore(row: GradeRow, item: GradeItem, input: HTMLInputElement): void {
    const current = this.scoreOf(row, item);
    const raw = input.value.trim();
    const score = raw === '' ? null : Number(raw);
    this.saved.set(false);
    this.error.set(null);

    if (score !== null && (Number.isNaN(score) || score < 0 || score > item.maxPoints)) {
      this.error.set(this.transloco.translate('gradebook.tooHigh', { max: item.maxPoints }));
      input.value = current === null ? '' : String(current);
      return;
    }
    if (score === current) return;

    this.academics.saveScore(this.org, this.classId, this.assignmentId, item.id, row.userId, score).subscribe({
      next: () => {
        this.saved.set(true);
        this.load(updated => {
          // The binding only writes when its value changes, so a cleared linked cell needs this to show the lesson's score again.
          const after = updated.students.find(s => s.userId === row.userId);
          const value = after ? this.scoreOf(after, item) : null;
          input.value = value === null ? '' : String(value);
        });
      },
      error: err => {
        input.value = current === null ? '' : String(current);
        this.fail(err);
      },
    });
  }

  protected exportExcel(): void {
    const book = this.book();
    if (!book) return;
    this.academics.exportGradebook(this.org, this.classId, this.assignmentId, book.termId).subscribe({
      next: blob => saveBlob(blob, `grades-${book.className}-${book.subjectName}-${book.termName}.xlsx`),
      error: err => this.fail(err),
    });
  }

  // ---- categories --------------------------------------------------------------------------------------

  protected newCategory(): void {
    this.itemDraft.set(null);
    this.categoryDraft.set({ id: null, name: '', weight: null });
  }

  protected editCategory(category: GradeCategory): void {
    this.itemDraft.set(null);
    this.categoryDraft.set({ id: category.id, name: category.name, weight: category.weightPercent });
  }

  protected patchCategory(changes: Partial<CategoryDraft>): void {
    this.categoryDraft.update(d => (d ? { ...d, ...changes } : d));
  }

  protected saveCategory(): void {
    const draft = this.categoryDraft();
    if (!draft?.weight) return;
    this.academics
      .saveCategory(this.org, this.classId, this.assignmentId, draft.id, { termId: this.termId()!, name: draft.name.trim(), weightPercent: draft.weight })
      .subscribe({
        next: () => {
          this.categoryDraft.set(null);
          this.load();
        },
        error: err => this.fail(err),
      });
  }

  protected deleteCategory(category: GradeCategory): void {
    this.academics.deleteCategory(this.org, this.classId, this.assignmentId, category.id).subscribe({ next: () => this.load(), error: err => this.fail(err) });
  }

  // ---- assessments -------------------------------------------------------------------------------------

  protected newItem(category: GradeCategory): void {
    this.categoryDraft.set(null);
    this.itemDraft.set({ categoryId: category.id, id: null, title: '', maxPoints: null, lessonId: null });
  }

  protected editItem(category: GradeCategory, item: GradeItem): void {
    this.categoryDraft.set(null);
    this.itemDraft.set({ categoryId: category.id, id: item.id, title: item.title, maxPoints: item.maxPoints, lessonId: item.sourceLessonId });
  }

  protected patchItem(changes: Partial<ItemDraft>): void {
    this.itemDraft.update(d => (d ? { ...d, ...changes } : d));
  }

  protected saveItem(): void {
    const draft = this.itemDraft();
    if (!draft?.maxPoints) return;
    this.academics
      .saveItem(this.org, this.classId, this.assignmentId, draft.categoryId, draft.id, { title: draft.title.trim(), maxPoints: draft.maxPoints, sourceLessonId: draft.lessonId })
      .subscribe({
        next: () => {
          this.itemDraft.set(null);
          this.load();
        },
        error: err => this.fail(err),
      });
  }

  /** Enter moves down the column, the way spreadsheets work; the change event saves the score. */
  protected moveDown(itemId: string, row: number): void {
    const next = document.querySelector<HTMLInputElement>(`input[data-grade-col="${itemId}"][data-grade-row="${row + 1}"]`);
    if (next) {
      next.focus(); // leaving the field fires its change event, which saves
      next.select();
    } else {
      (document.activeElement as HTMLElement | null)?.blur();
    }
  }

  protected async deleteItem(item: GradeItem): Promise<void> {
    if (!(await this.confirmer.confirm({ title: this.transloco.translate('gradebook.confirmDeleteItem', { title: item.title }), confirmText: this.transloco.translate('action.delete'), cancelText: this.transloco.translate('action.cancel'), tone: 'danger' }))) return;
    this.academics.deleteItem(this.org, this.classId, this.assignmentId, item.id).subscribe({ next: () => this.load(), error: err => this.fail(err) });
  }

  private load(after?: (book: Gradebook) => void): void {
    const termId = this.termId();
    if (!termId) return;
    this.academics.gradebook(this.org, this.classId, this.assignmentId, termId).subscribe({
      next: book => {
        this.book.set(book);
        after?.(book);
      },
      error: err => this.fail(err),
    });
  }

  private fail(err: unknown): void {
    this.error.set(errorMessages(err, this.transloco.translate('error.generic')).join(' '));
  }

  private get org(): string {
    return this.orgContext.requireActiveSlug();
  }
}
