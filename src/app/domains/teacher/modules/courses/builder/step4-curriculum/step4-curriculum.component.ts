import { Component, inject, signal, effect } from '@angular/core';
import { CourseBuilderStateService } from '../course-builder-state.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { form, required, submit, validate } from '@angular/forms/signals';

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

  isSaving = signal(false);
  isPublishing = signal(false);
  
  chapters = signal<{title: string}[]>([{ title: 'Introduction' }]);
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
          this.chapters.set(state.chapters);
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
    this.chapters.update(c => {
      const newC = [...c];
      newC[index].title = title;
      return newC;
    });
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

  onSaveDraft() {
    if (!this.validateChapters()) return;

    this.isSaving.set(true);
    const draftId = this.builderState.state().id!;
    this.builderState.updateChapters(draftId, this.chapters(), this.syllabusReqs()).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.router.navigate(['/teacher/courses', draftId, 'curriculum']);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.chapterError.set('Failed to save curriculum. Please try again.');
        console.error(err);
      }
    });
  }

  onPublish() {
    if (!this.canPublish() || !this.validateChapters()) return;

    this.isPublishing.set(true);
    const draftId = this.builderState.state().id!;

    this.builderState.updateChapters(draftId, this.chapters(), this.syllabusReqs()).subscribe(() => {
      this.builderState.publishCourse(draftId).subscribe(() => {
        this.isPublishing.set(false);
        this.router.navigate(['/teacher/courses', draftId, 'curriculum']);
      });
    });
  }

  goBack() {
    const currentDraft = this.builderState.state();
    if (currentDraft.id) {
      this.router.navigate(['/teacher/courses', currentDraft.id, 'edit', 'step-3']);
    } else {
      this.router.navigate(['/teacher/dashboard']);
    }
  }
}
