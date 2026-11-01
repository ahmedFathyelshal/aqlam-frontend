import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { tap } from 'rxjs/operators';

import { CourseBuilderStateService } from '../builder/course-builder-state.service';
import { ApiEndpoints } from '@/app/core/constants/api-endpoints';
import { OrgContextService } from '@/app/core/organizations/org-context.service';
import {
  CourseChapter,
  CourseDraft,
  CourseLesson,
  LessonResource,
  LessonType,
  ResourceType
} from '../builder/course-builder.models';

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
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatSidenavModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  templateUrl: './curriculum-workspace.component.html',
  styleUrls: ['./curriculum-workspace.component.scss'],
})
export default class CurriculumWorkspaceComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  protected orgContext = inject(OrgContextService);
  private builderState = inject(CourseBuilderStateService);
  private snackBar = inject(MatSnackBar);

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
    if (this.drawerMode() === 'chapter') return this.activeChapter()?.title ?? 'New Chapter';
    if (this.drawerMode() === 'lesson') return this.activeLesson()?.title ?? 'New Lesson';
    return '';
  });

  LessonTypeOptions = [
    { value: LessonType.Video, label: 'Video', icon: 'play-circle' },
    { value: LessonType.Article, label: 'Article', icon: 'file-text' },
    { value: LessonType.Quiz, label: 'Quiz', icon: 'circle-help' },
    { value: LessonType.Assignment, label: 'Assignment', icon: 'clipboard-list' },
  ];

  ResourceTypeOptions = [
    { value: ResourceType.File, label: 'File / PDF' },
    { value: ResourceType.Link, label: 'External Link' },
  ];

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
          const normalized: CourseDraft = {
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
          this.course.set(normalized);
          this.builderState.state.update((s) => ({ ...s, ...normalized }));
        },
        error: () => {
          this.isLoading.set(false);
          this.snackBar.open('Failed to load course curriculum.', 'Close', { duration: 5000 });
        },
      });
  }

  saveCurriculum() {
    const id = this.courseId();
    if (!id) return;
    this.isSaving.set(true);

    const chapters = this.chapters().map((c, ci) => ({
      ...c,
      order: ci,
      lessons: c.lessons.map((l, li) => ({ ...l, order: li })),
    }));

    const payload = { id, chapters, syllabusRequirements: this.course().syllabusRequirements };

    this.http
      .put(ApiEndpoints.TeacherCourses.UpdateCurriculum(this.orgContext.requireActiveSlug(), id), payload)
      .pipe(tap(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.snackBar.open('Curriculum saved.', 'Close', { duration: 3000 });
        },
        error: () => {
          this.snackBar.open('Failed to save curriculum.', 'Close', { duration: 5000 });
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
        { title: `New Chapter`, order: (c.chapters?.length ?? 0), lessons: [] },
      ],
    }));
    this.openChapter((this.course().chapters?.length ?? 1) - 1);
  }

  removeChapter(index: number) {
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
          title: 'New Lesson',
          order: chapter.lessons.length,
          isPublished: false,
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
