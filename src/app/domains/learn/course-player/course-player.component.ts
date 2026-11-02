import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import {
  LearnerCourse,
  LearnerLesson,
  LearningService,
  LessonContent,
} from '@/app/core/learning/learning.service';
import { parseVideoSource, VideoSource } from '@/app/core/learning/video-source';
import { WatchTracker } from '@/app/core/learning/watch-tracker';

import { AssignmentPanelComponent } from '../assignment-panel/assignment-panel.component';
import { QuizPanelComponent } from '../quiz-panel/quiz-panel.component';

const HEARTBEAT_MS = 15_000;

/**
 * Course player: outline with lock/completion state, lesson viewer and progress heartbeats.
 * Video progress counts seconds actually played (HTML5 video, YouTube and Vimeo via their postMessage APIs).
 */
@Component({
  selector: 'app-course-player',
  imports: [
    AssignmentPanelComponent,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    QuizPanelComponent,
    RouterLink,
  ],
  templateUrl: './course-player.component.html',
})
export default class CoursePlayerComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private learning = inject(LearningService);
  private sanitizer = inject(DomSanitizer);
  private snackBar = inject(MatSnackBar);
  private destroyRef = inject(DestroyRef);

  protected org = '';
  protected courseId = '';

  protected course = signal<LearnerCourse | null>(null);
  protected lesson = signal<LessonContent | null>(null);
  protected lessonError = signal<string | null>(null);
  protected courseError = signal<string | null>(null);
  protected loadingLesson = signal(false);
  protected markingDone = signal(false);

  protected videoSource = computed<VideoSource | null>(() =>
    parseVideoSource(this.lesson()?.videoUrl, typeof window !== 'undefined' ? window.location.origin : '')
  );
  protected embedUrl = computed<SafeResourceUrl | null>(() => {
    const source = this.videoSource();
    // Only URLs produced by parseVideoSource (YouTube/Vimeo embeds) are ever trusted as resource URLs.
    return source && 'embedUrl' in source ? this.sanitizer.bypassSecurityTrustResourceUrl(source.embedUrl) : null;
  });

  protected flatLessons = computed<LearnerLesson[]>(() => this.course()?.chapters.flatMap(c => c.lessons) ?? []);

  private videoElement = viewChild<ElementRef<HTMLVideoElement>>('video');
  private embedFrame = viewChild<ElementRef<HTMLIFrameElement>>('embed');

  private tracker: WatchTracker | null = null;
  private lastSentPercent = -1;
  private lastPosition = 0;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private readonly onMessage = (event: MessageEvent) => this.handleEmbedMessage(event);

  ngOnInit(): void {
    window.addEventListener('message', this.onMessage);
    this.heartbeat = setInterval(() => this.sendProgress(), HEARTBEAT_MS);

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const org = params.get('org')!;
      const courseId = params.get('courseId')!;
      const lessonId = params.get('lessonId');

      if (org !== this.org || courseId !== this.courseId) {
        this.org = org;
        this.courseId = courseId;
        this.loadCourse(lessonId);
      } else if (lessonId) {
        this.openLesson(lessonId);
      }
    });
  }

  ngOnDestroy(): void {
    this.sendProgress();
    window.removeEventListener('message', this.onMessage);
    if (this.heartbeat) clearInterval(this.heartbeat);
  }

  protected lessonLink(lessonId: string): string[] {
    return ['/learn', this.org, this.courseId, lessonId];
  }

  protected lockText(lesson: LearnerLesson): string {
    switch (lesson.lockReason) {
      case 'CourseNotStarted':
        return 'Course starts soon';
      case 'DripSchedule':
        return lesson.unlocksAtUtc ? `Unlocks ${new Date(lesson.unlocksAtUtc).toLocaleDateString()}` : 'Unlocks later';
      case 'PreviousLessonRequired':
        return 'Complete the previous lesson first';
      default:
        return 'Locked';
    }
  }

  // ---- video events (HTML5) ----------------------------------------------------------------------------

  protected onVideoReady(video: HTMLVideoElement): void {
    this.tracker?.setDuration(video.duration);
    const resumeAt = this.lesson()?.lastPositionSeconds ?? 0;
    if (resumeAt > 0 && resumeAt < video.duration - 5) {
      video.currentTime = resumeAt;
    }
  }

  protected onVideoTime(video: HTMLVideoElement): void {
    this.lastPosition = Math.floor(video.currentTime);
    this.tracker?.onTime(video.currentTime);
  }

  protected onVideoPausedOrEnded(): void {
    this.sendProgress();
  }

  // ---- article -----------------------------------------------------------------------------------------

  protected markArticleDone(): void {
    const lesson = this.lesson();
    if (!lesson || lesson.isCompleted || this.course()?.isPreview) return;

    this.markingDone.set(true);
    this.learning.recordProgress(this.org, lesson.id, { markCompleted: true }).subscribe({
      next: result => {
        this.markingDone.set(false);
        this.afterProgress(result.isCompleted, result.justCompleted);
      },
      error: () => this.markingDone.set(false),
    });
  }

  /** A passed quiz or a handed-in assignment completed the lesson: refresh the outline (it may unlock the next lesson). */
  protected onAssessmentCompleted(): void {
    this.lesson.update(l => (l ? { ...l, isCompleted: true } : l));
    this.learning.course(this.org, this.courseId).subscribe(course => this.course.set(course));
  }

  // ---- loading -----------------------------------------------------------------------------------------

  private loadCourse(lessonId: string | null): void {
    this.courseError.set(null);
    this.learning.course(this.org, this.courseId).subscribe({
      next: course => {
        this.course.set(course);
        const target = lessonId ?? course.resumeLessonId ?? this.flatLessons()[0]?.id;
        if (!lessonId && target) {
          this.router.navigate(this.lessonLink(target), { replaceUrl: true });
        } else if (target) {
          this.openLesson(target);
        }
      },
      error: (err: unknown) => this.courseError.set(this.reasonOf(err, 'This course is not available.')),
    });
  }

  private openLesson(lessonId: string): void {
    this.sendProgress(); // flush the previous lesson
    this.loadingLesson.set(true);
    this.lessonError.set(null);
    this.lesson.set(null);
    this.tracker = null;

    this.learning.lesson(this.org, lessonId).subscribe({
      next: lesson => {
        this.loadingLesson.set(false);
        this.lesson.set(lesson);
        this.lastSentPercent = lesson.watchedPercent;
        this.lastPosition = lesson.lastPositionSeconds;
        this.tracker = lesson.type === 'Video'
          ? new WatchTracker((lesson.durationInMinutes ?? 0) * 60, lesson.watchedPercent)
          : null;
      },
      error: (err: unknown) => {
        this.loadingLesson.set(false);
        this.lessonError.set(this.reasonOf(err, 'This lesson is not available.'));
      },
    });
  }

  private sendProgress(): void {
    const lesson = this.lesson();
    if (!lesson || lesson.type !== 'Video' || !this.tracker || this.course()?.isPreview) return;

    const watched = this.tracker.watchedPercent;
    if (watched <= this.lastSentPercent && lesson.isCompleted) return; // nothing new to say
    if (watched === this.lastSentPercent && this.lastPosition === lesson.lastPositionSeconds) return;

    this.lastSentPercent = watched;
    this.learning
      .recordProgress(this.org, lesson.id, { positionSeconds: this.lastPosition, watchedPercent: watched })
      .subscribe({ next: result => this.afterProgress(result.isCompleted, result.justCompleted) });
  }

  private afterProgress(isCompleted: boolean, justCompleted: boolean): void {
    this.lesson.update(l => (l ? { ...l, isCompleted } : l));
    if (justCompleted) {
      this.snackBar.open('Lesson completed. Well done!', 'Close', { duration: 3000 });
      // Completion can unlock the next lesson: refresh the outline.
      this.learning.course(this.org, this.courseId).subscribe(course => this.course.set(course));
    }
  }

  // ---- embedded players (YouTube / Vimeo postMessage APIs) ----------------------------------------------

  protected onEmbedLoad(): void {
    const frame = this.embedFrame()?.nativeElement;
    const source = this.videoSource();
    if (!frame?.contentWindow || !source) return;

    if (source.kind === 'youtube') {
      frame.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
    } else if (source.kind === 'vimeo') {
      frame.contentWindow.postMessage(JSON.stringify({ method: 'addEventListener', value: 'timeupdate' }), 'https://player.vimeo.com');
      frame.contentWindow.postMessage(JSON.stringify({ method: 'addEventListener', value: 'pause' }), 'https://player.vimeo.com');
    }
  }

  private handleEmbedMessage(event: MessageEvent): void {
    const isYouTube = /^https:\/\/www\.youtube(-nocookie)?\.com$/.test(event.origin);
    const isVimeo = event.origin === 'https://player.vimeo.com';
    if ((!isYouTube && !isVimeo) || !this.tracker) return;

    let data: Record<string, unknown>;
    try {
      data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    } catch {
      return;
    }

    if (isYouTube && data['event'] === 'infoDelivery') {
      const info = data['info'] as { currentTime?: number; duration?: number; playerState?: number } | undefined;
      if (info?.duration) this.tracker.setDuration(info.duration);
      if (typeof info?.currentTime === 'number') {
        this.lastPosition = Math.floor(info.currentTime);
        this.tracker.onTime(info.currentTime);
      }
      if (info?.playerState === 0 || info?.playerState === 2) this.sendProgress(); // ended / paused
    } else if (isVimeo) {
      const payload = data['data'] as { duration?: number; seconds?: number } | undefined;
      if (data['event'] === 'timeupdate' && payload) {
        if (payload.duration) this.tracker.setDuration(payload.duration);
        if (typeof payload.seconds === 'number') {
          this.lastPosition = Math.floor(payload.seconds);
          this.tracker.onTime(payload.seconds);
        }
      } else if (data['event'] === 'pause') {
        this.sendProgress();
      }
    }
  }

  private reasonOf(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const message = (err.error as { errors?: string[] } | null)?.errors?.[0];
      if (err.status === 403 && message) return message;
      if (err.status === 404) return fallback;
    }
    return fallback;
  }
}
