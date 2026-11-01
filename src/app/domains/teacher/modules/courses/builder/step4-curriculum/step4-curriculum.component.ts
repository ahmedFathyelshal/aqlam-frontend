import { Component, inject, signal, effect } from '@angular/core';
import { CourseBuilderStateService } from '../course-builder-state.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { form, required, submit, validate } from '@angular/forms/signals';
import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { HttpErrorResponse } from '@angular/common/http';
import { switchMap } from 'rxjs';
import { ApiValidationError } from '@/app/core/utils/api-error.utils';
import { CourseStatus } from '../course-builder.models';

@Component({
  selector: 'app-step4-curriculum',
  templateUrl: './step4-curriculum.component.html',
  styleUrls: ['./step4-curriculum.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ]
})
export default class Step4CurriculumComponent {
  private builderState = inject(CourseBuilderStateService);
  private router = inject(Router);
  protected orgContext = inject(OrgContextService);

  isSaving = signal(false);
  isPublishing = signal(false);
  
  chapters = signal<{ id?: string; title: string }[]>([{ title: 'Introduction' }]);
  syllabusReqs = signal('');
  chapterError = signal<string | null>(null);

  // Computed completeness checks
  hasIdentity = signal(false);
  hasCommercials = signal(false);
  hasMedia = signal(false);

  constructor() {
    effect(() => {
      const state = this.builderState.state();
      if (state) {
        this.hasIdentity.set(!!state.title && !!state.stageId && !!state.gradeId && !!state.subjectId);
        this.hasCommercials.set(!!state.pricingType && !!state.accessExpiryPolicy);
        this.hasMedia.set(!!state.subtitle && !!state.thumbnailUrl);

        if (state.chapters && state.chapters.length > 0) {
          this.chapters.set(state.chapters.map(c => ({ id: c.id, title: c.title })));
        }
        if (state.syllabusRequirements) {
          this.syllabusReqs.set(state.syllabusRequirements);
        }
      }
    }, { allowSignalWrites: true });
  }

  addChapter() {
    this.chapters.update(c => [...c, { title: '' }]);
  }

  removeChapter(index: number) {
    this.chapters.update(c => c.filter((_, i) => i !== index));
  }

  updateChapterTitle(index: number, title: string) {
    this.chapters.update(c => c.map((chapter, i) => (i === index ? { ...chapter, title } : chapter)));
  }

  canPublish(): boolean {
    return this.hasIdentity() && this.hasCommercials() && this.hasMedia() && this.chapters().length > 0;
  }

  validateChapters(): boolean {
    if (this.chapters().length === 0) {
      this.chapterError.set('You must add at least one chapter.');
      return false;
    }
    if (this.chapters().some(c => !c.title.trim())) {
      this.chapterError.set('All chapters must have a title.');
      return false;
    }
    this.chapterError.set(null);
    return true;
  }

  /** Chapter titles only: lessons are managed in the curriculum workspace and stay untouched. */
  private saveChapters() {
    const draftId = this.builderState.state().id!;
    const chapters = this.chapters().map(c => ({ id: c.id, title: c.title.trim() }));
    return this.builderState.syncCurriculum(draftId, chapters, this.syllabusReqs());
  }

  onSaveDraft() {
    if (!this.validateChapters()) return;

    this.isSaving.set(true);
    const draftId = this.builderState.state().id!;
    this.saveChapters().subscribe({
      next: () => {
        this.isSaving.set(false);
        this.router.navigate(this.orgContext.path('courses', draftId, 'curriculum'));
      },
      error: (err) => {
        this.isSaving.set(false);
        this.chapterError.set(this.describeError(err, 'Failed to save curriculum. Please try again.'));
      }
    });
  }

  onPublish() {
    if (!this.canPublish() || !this.validateChapters()) return;

    this.isPublishing.set(true);
    const draftId = this.builderState.state().id!;

    this.saveChapters()
      .pipe(switchMap(() => this.builderState.changeStatus(draftId, CourseStatus.Published)))
      .subscribe({
        next: () => {
          this.isPublishing.set(false);
          this.router.navigate(this.orgContext.path('courses', draftId, 'curriculum'));
        },
        error: (err) => {
          this.isPublishing.set(false);
          // 400 carries the publish checklist: show what is still missing.
          this.chapterError.set(this.describeError(err, 'Publishing failed. Please try again.'));
        }
      });
  }

  private describeError(err: unknown, fallback: string): string {
    if (err instanceof ApiValidationError && err.errors.length) {
      return err.errors.join(' • ');
    }
    if (err instanceof HttpErrorResponse && err.status === 409) {
      return 'Someone else changed this course. Reload the page to see the latest version.';
    }
    if (err instanceof HttpErrorResponse && err.status === 403) {
      return 'Only an administrator of this organization can publish courses.';
    }
    return fallback;
  }

  goBack() {
    const currentDraft = this.builderState.state();
    if (currentDraft.id) {
      this.router.navigate(this.orgContext.path('courses', currentDraft.id, 'edit', 'step-3'));
    } else {
      this.router.navigate(this.orgContext.path('dashboard'));
    }
  }
}
