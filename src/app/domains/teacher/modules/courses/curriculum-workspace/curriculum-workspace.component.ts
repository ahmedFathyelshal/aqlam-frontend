import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { tap } from 'rxjs/operators';

import { CourseBuilderStateService } from '../builder/course-builder-state.service';
import { ApiValidationError } from '@/app/core/utils/api-error.utils';
import { OrgContextService } from '@/app/core/organizations/org-context.service';
import {
  CourseChapter,
  CourseDraft,
  CourseLesson,
  LessonResource,
  CourseStatus,
  LessonType,
  ResourceType
} from '../builder/course-builder.models';
import { ConfirmService } from '@/app/shared/ui/confirm.service';

type DrawerTarget =
  | { mode: 'chapter'; chapterIndex: number }
  | { mode: 'lesson'; chapterIndex: number; lessonIndex: number }
  | null;

@Component({
  selector: 'app-curriculum-workspace',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoDirective,
  ],
  templateUrl: './curriculum-workspace.component.html',
})
export default class CurriculumWorkspaceComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  protected orgContext = inject(OrgContextService);
  private builderState = inject(CourseBuilderStateService);
  private snackBar = inject(MatSnackBar);
  private transloco = inject(TranslocoService);
  private confirmer = inject(ConfirmService);

  isPublishing = signal(false);
  /** What still blocks publishing (from the server's checklist). */
  publishIssues = signal<string[]>([]);

  courseId = signal<string>('');
  isLoading = signal(true);
  isSaving = signal(false);
  drawerOpened = signal(false);
  drawerMode = signal<'chapter' | 'lesson' | null>(null);
  activeChapterIndex = signal<number | null>(null);
  activeLessonIndex = signal<number | null>(null);

  course = signal<CourseDraft>({ status: 'Draft' as any, chapters: [] });

  chapters = computed<CourseChapter[]>(() => this.course().chapters ?? []);

  activeChapter = computed<CourseChapter | null>(() => {
    const i = this.activeChapterIndex();
    if (i === null) return null;
    return this.chapters()[i] ?? null;
  });

  activeLesson = computed<CourseLesson | null>(() => {
    const ci = this.activeChapterIndex();
    const li = this.activeLessonIndex();
    if (ci === null || li === null) return null;
    return this.chapters()[ci]?.lessons[li] ?? null;
  });

  drawerTitle = computed(() => {
    if (this.drawerMode() === 'chapter') return this.activeChapter()?.title || this.transloco.translate('cw.untitledChapter');
    if (this.drawerMode() === 'lesson') return this.activeLesson()?.title || this.transloco.translate('cw.untitledLesson');
    return '';
  });

  LessonTypeOptions = [
    { value: LessonType.Video, icon: 'circle-play' },
    { value: LessonType.Article, icon: 'file-text' },
    { value: LessonType.Quiz, icon: 'circle-question-mark' },
    { value: LessonType.Assignment, icon: 'clipboard-list' },
  ];

  ResourceTypeOptions = [ResourceType.File, ResourceType.Link];

  lessonCount = computed(() => this.chapters().reduce((sum, c) => sum + c.lessons.length, 0));

  lessonIcon(type: LessonType): string {
    return this.LessonTypeOptions.find(o => o.value === type)?.icon ?? 'file-text';
  }

  constructor() {
    effect(
      () => {
        const id = this.route.snapshot.paramMap.get('id');
        if (!id) {
          this.router.navigate(this.orgContext.path('dashboard'));
          return;
        }
        this.courseId.set(id);
        this.loadCourse(id);
      },
      { allowSignalWrites: true }
    );
  }

  loadCourse(id: string) {
    this.isLoading.set(true);
    this.builderState
      .getCourseDraft(id)
      .pipe(tap(() => this.isLoading.set(false)))
      .subscribe({
        next: (draft) => {
          const normalized = this.normalize(draft);
          this.course.set(normalized);
          this.builderState.state.update((s) => ({ ...s, ...normalized }));
        },
        error: () => {
          this.isLoading.set(false);
          this.snackBar.open('Failed to load course curriculum.', 'Close', { duration: 5000 });
        },
      });
  }

  /** Fills defaults so the editor can bind every field. */
  private normalize(draft: CourseDraft): CourseDraft {
    return {
            ...draft,
            chapters: (draft.chapters ?? []).map((ch: any, ci: number) => ({
              id: ch.id,
              title: ch.title ?? '',
              order: ch.order ?? ci,
              lessons: (ch.lessons ?? []).map((ls: any, li: number) => ({
                id: ls.id,
                title: ls.title ?? '',
                order: ls.order ?? li,
                isPublished: !!ls.isPublished,
                type: (ls.type as LessonType) ?? LessonType.Video,
                durationInMinutes: ls.durationInMinutes ?? null,
                isFreePreview: !!ls.isFreePreview,
                videoUrl: ls.videoUrl ?? '',
                summary: ls.summary ?? '',
                content: ls.content ?? '',
                unlockDaysAfterEnrollment: ls.unlockDaysAfterEnrollment ?? 0,
                requirePreviousLessonCompletion: !!ls.requirePreviousLessonCompletion,
                resources: (ls.resources ?? []).map((r: any) => ({
                  id: r.id,
                  displayName: r.displayName ?? '',
                  resourceUrl: r.resourceUrl ?? '',
                  type: (r.type as ResourceType) ?? ResourceType.File,
                  isDownloadable: r.isDownloadable !== false,
                })),
              })),
            })),
    };
  }

  /**
   * Saves the whole tree; the server keeps ids, creates new items and soft-deletes removed ones.
   * The response (with ids for new items and the new version) replaces the local copy.
   */
  saveCurriculum() {
    const id = this.courseId();
    if (!id) return;
    this.isSaving.set(true);

    const chapters = this.chapters().map((c) => ({ id: c.id, title: c.title, lessons: c.lessons }));

    this.builderState
      .syncCurriculum(id, chapters, this.course().syllabusRequirements)
      .pipe(tap({ next: () => this.isSaving.set(false), error: () => this.isSaving.set(false) }))
      .subscribe({
        next: (draft) => {
          this.course.set(this.normalize(draft));
          this.publishIssues.set([]);
          this.snackBar.open(this.transloco.translate('cw.saved'), '✓', { duration: 3000 });
        },
        error: (err: unknown) => {
          if (err instanceof HttpErrorResponse && err.status === 409) {
            this.snackBar.open(this.transloco.translate('cw.conflict'), '✓', { duration: 6000 });
            this.loadCourse(id);
            return;
          }
          const message = err instanceof ApiValidationError && err.errors.length ? err.errors.join(' • ') : this.transloco.translate('cw.saveFailed');
          this.snackBar.open(message, '✓', { duration: 6000 });
        },
      });
  }

  /** Publishes after checking the server's checklist; unsaved edits must be saved first. */
  publish() {
    const id = this.courseId();
    if (!id) return;
    this.isPublishing.set(true);
    this.publishIssues.set([]);
    this.builderState.changeStatus(id, CourseStatus.Published).subscribe({
      next: draft => {
        this.isPublishing.set(false);
        this.course.update(c => ({ ...c, status: draft.status }));
        this.snackBar.open(this.transloco.translate('cw.published'), '✓', { duration: 5000 });
      },
      error: (err: unknown) => {
        this.isPublishing.set(false);
        this.publishIssues.set(err instanceof ApiValidationError && err.errors.length ? err.errors : [this.transloco.translate('cb.s4.publishFailed')]);
      },
    });
  }

  openChapter(chapterIndex: number) {
    this.activeChapterIndex.set(chapterIndex);
    this.activeLessonIndex.set(null);
    this.drawerMode.set('chapter');
    this.drawerOpened.set(true);
  }

  openLesson(chapterIndex: number, lessonIndex: number) {
    this.activeChapterIndex.set(chapterIndex);
    this.activeLessonIndex.set(lessonIndex);
    this.drawerMode.set('lesson');
    this.drawerOpened.set(true);
  }

  closeDrawer() {
    this.drawerOpened.set(false);
    setTimeout(() => {
      this.drawerMode.set(null);
      this.activeChapterIndex.set(null);
      this.activeLessonIndex.set(null);
    }, 300);
  }

  addChapter() {
    this.course.update((c) => ({
      ...c,
      chapters: [
        ...(c.chapters ?? []),
        { title: this.transloco.translate('cw.newChapter'), order: (c.chapters?.length ?? 0), lessons: [] },
      ],
    }));
    this.openChapter((this.course().chapters?.length ?? 1) - 1);
  }

  async removeChapter(index: number) {
    const chapter = this.course().chapters?.[index];
    if (chapter?.lessons.length && !(await this.confirmer.confirm({
      title: this.transloco.translate('cw.confirmRemoveChapter', { title: chapter.title || this.transloco.translate('cw.untitledChapter'), count: chapter.lessons.length }),
      body: this.transloco.translate('cw.confirmRemoveHint'),
      confirmText: this.transloco.translate('action.delete'),
      cancelText: this.transloco.translate('action.cancel'),
      tone: 'danger',
    }))) return;
    this.course.update((c) => ({
      ...c,
      chapters: (c.chapters ?? []).filter((_, i) => i !== index),
    }));
    this.closeDrawer();
  }

  addLesson(chapterIndex: number) {
    this.course.update((c) => {
      const chapters = [...(c.chapters ?? [])];
      const chapter = { ...chapters[chapterIndex] };
      const lessons: CourseLesson[] = [
        ...chapter.lessons,
        {
          title: this.transloco.translate('cw.newLesson'),
          order: chapter.lessons.length,
          isPublished: true, // the course itself is a draft until published
          type: LessonType.Video,
          isFreePreview: false,
          unlockDaysAfterEnrollment: 0,
          requirePreviousLessonCompletion: false,
          resources: [],
        },
      ];
      chapters[chapterIndex] = { ...chapter, lessons };
      return { ...c, chapters };
    });
    const lessons = this.chapters()[chapterIndex].lessons;
    this.openLesson(chapterIndex, lessons.length - 1);
  }

  removeLesson(chapterIndex: number, lessonIndex: number) {
    this.course.update((c) => {
      const chapters = [...(c.chapters ?? [])];
      const chapter = { ...chapters[chapterIndex] };
      chapter.lessons = chapter.lessons.filter((_, i) => i !== lessonIndex);
      chapters[chapterIndex] = chapter;
      return { ...c, chapters };
    });
    this.closeDrawer();
  }

  updateChapterTitle(chapterIndex: number, value: string) {
    this.course.update((c) => {
      const chapters = [...(c.chapters ?? [])];
      chapters[chapterIndex] = { ...chapters[chapterIndex], title: value };
      return { ...c, chapters };
    });
  }

  updateLessonField<K extends keyof CourseLesson>(
    chapterIndex: number,
    lessonIndex: number,
    field: K,
    value: CourseLesson[K]
  ) {
    this.course.update((c) => {
      const chapters = [...(c.chapters ?? [])];
      const chapter = { ...chapters[chapterIndex] };
      const lessons = [...chapter.lessons];
      lessons[lessonIndex] = { ...lessons[lessonIndex], [field]: value };
      chapters[chapterIndex] = { ...chapter, lessons };
      return { ...c, chapters };
    });
  }

  addResource(chapterIndex: number, lessonIndex: number) {
    this.course.update((c) => {
      const chapters = [...(c.chapters ?? [])];
      const chapter = { ...chapters[chapterIndex] };
      const lessons = [...chapter.lessons];
      const lesson = { ...lessons[lessonIndex] };
      lesson.resources = [
        ...lesson.resources,
        {
          displayName: 'New Resource',
          resourceUrl: '',
          type: ResourceType.File,
          isDownloadable: true,
        },
      ];
      lessons[lessonIndex] = lesson;
      chapters[chapterIndex] = { ...chapter, lessons };
      return { ...c, chapters };
    });
  }

  updateResourceField<K extends keyof LessonResource>(
    chapterIndex: number,
    lessonIndex: number,
    resourceIndex: number,
    field: K,
    value: LessonResource[K]
  ) {
    this.course.update((c) => {
      const chapters = [...(c.chapters ?? [])];
      const chapter = { ...chapters[chapterIndex] };
      const lessons = [...chapter.lessons];
      const lesson = { ...lessons[lessonIndex] };
      const resources = [...lesson.resources];
      resources[resourceIndex] = { ...resources[resourceIndex], [field]: value };
      lesson.resources = resources;
      lessons[lessonIndex] = lesson;
      chapters[chapterIndex] = { ...chapter, lessons };
      return { ...c, chapters };
    });
  }

  removeResource(chapterIndex: number, lessonIndex: number, resourceIndex: number) {
    this.course.update((c) => {
      const chapters = [...(c.chapters ?? [])];
      const chapter = { ...chapters[chapterIndex] };
      const lessons = [...chapter.lessons];
      const lesson = { ...lessons[lessonIndex] };
      lesson.resources = lesson.resources.filter((_, i) => i !== resourceIndex);
      lessons[lessonIndex] = lesson;
      chapters[chapterIndex] = { ...chapter, lessons };
      return { ...c, chapters };
    });
  }
}
