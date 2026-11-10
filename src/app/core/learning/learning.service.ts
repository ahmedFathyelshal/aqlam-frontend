import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { ApiEndpoints } from '../constants/api-endpoints';
import { ApiResponse } from '../models/api-response.model';

export type LearnerLesson = {
  durationInMinutes: number | null;
  id: string;
  isCompleted: boolean;
  isLocked: boolean;
  lockReason: 'CourseNotStarted' | 'DripSchedule' | 'PreviousLessonRequired' | null;
  title: string;
  type: 'Article' | 'Assignment' | 'Quiz' | 'Video';
  unlocksAtUtc: string | null;
  watchedPercent: number;
};

export type LearnerChapter = { id: string; lessons: LearnerLesson[]; title: string };

export type LearnerCourse = {
  accessExpiresAtUtc: string | null;
  chapters: LearnerChapter[];
  id: string;
  isPreview: boolean;
  progressPercent: number;
  resumeLessonId: string | null;
  status: string;
  subtitle: string | null;
  thumbnailUrl: string | null;
  title: string;
};

export type LessonResourceItem = { displayName: string; id: string; isDownloadable: boolean; resourceUrl: string; type: string };

export type LessonContent = {
  content: string | null;
  courseId: string;
  durationInMinutes: number | null;
  id: string;
  isCompleted: boolean;
  lastPositionSeconds: number;
  nextLessonId: string | null;
  previousLessonId: string | null;
  resources: LessonResourceItem[];
  summary: string | null;
  title: string;
  type: LearnerLesson['type'];
  videoUrl: string | null;
  watchedPercent: number;
};

export type ProgressResult = {
  courseProgressPercent: number;
  isCompleted: boolean;
  justCompleted: boolean;
  lastPositionSeconds: number;
  lessonId: string;
  watchedPercent: number;
};

export type MyCourse = {
  courseId: string;
  courseTitle: string;
  expiresAtUtc: string | null;
  isExpired: boolean;
  lastAccessedAtUtc: string | null;
  lastLessonId: string | null;
  organizationName: string;
  organizationSlug: string;
  progressPercent: number;
};

export type NextLesson = { courseId: string; lessonId: string; title: string; chapterTitle: string; type: LearnerLesson['type']; durationInMinutes: number | null };
export type DueItem = { courseId: string; courseTitle: string; lessonId: string; title: string; dueAtUtc: string; isOverdue: boolean };
export type LatestResult = { kind: 'Quiz' | 'Assignment'; courseId: string; courseTitle: string; lessonId: string; title: string; percent: number; atUtc: string };
export type LearnerHome = { nextLessons: NextLesson[]; due: DueItem[]; latestResult: LatestResult | null; achievementPercent: number };

export type JoinResult = { membershipStatus: 'Active' | 'Pending'; name: string; slug: string; type: string };

/** Student-side learning API (player, progress, enrollment). */
@Injectable({ providedIn: 'root' })
export class LearningService {
  private http = inject(HttpClient);

  myCourses(): Observable<MyCourse[]> {
    return this.http.get<ApiResponse<MyCourse[]>>(ApiEndpoints.Me.Courses).pipe(map(r => r.data ?? []));
  }

  home(org: string): Observable<LearnerHome> {
    return this.http.get<ApiResponse<LearnerHome>>(ApiEndpoints.Learn.Home(org)).pipe(map(r => r.data));
  }

  joinWithCode(code: string): Observable<JoinResult> {
    return this.http.post<ApiResponse<JoinResult>>(ApiEndpoints.Me.Join, { code }).pipe(map(r => r.data));
  }

  course(org: string, courseId: string): Observable<LearnerCourse> {
    return this.http.get<ApiResponse<LearnerCourse>>(ApiEndpoints.Learn.Course(org, courseId)).pipe(map(r => r.data));
  }

  enroll(org: string, courseId: string): Observable<MyCourse> {
    return this.http.post<ApiResponse<MyCourse>>(ApiEndpoints.Learn.Enroll(org, courseId), {}).pipe(map(r => r.data));
  }

  lesson(org: string, lessonId: string): Observable<LessonContent> {
    return this.http.get<ApiResponse<LessonContent>>(ApiEndpoints.Learn.Lesson(org, lessonId)).pipe(map(r => r.data));
  }

  recordProgress(
    org: string,
    lessonId: string,
    progress: { markCompleted?: boolean; positionSeconds?: number; watchedPercent?: number }
  ): Observable<ProgressResult> {
    return this.http
      .post<ApiResponse<ProgressResult>>(ApiEndpoints.Learn.Progress(org, lessonId), progress)
      .pipe(map(r => r.data));
  }
}
