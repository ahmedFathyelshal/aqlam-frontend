import { Injectable, signal, inject } from '@angular/core';
import { Observable, tap, map } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ApiEndpoints } from '../../../../../core/constants/api-endpoints';
import { OrgContextService } from '../../../../../core/organizations/org-context.service';

import {
  CourseDraft,
  ApiResponse,
  UpdateCourseIdentityRequest,
  UpdateCourseCommercialsRequest,
  UpdateCourseMediaRequest,
  CurriculumChapterInput,
  SyncCurriculumRequest,
  CourseStatus
} from './course-builder.models';

@Injectable({
  providedIn: 'root'
})
export class CourseBuilderStateService {
  private http = inject(HttpClient);
  private orgContext = inject(OrgContextService);

  // The global state for the builder
  state = signal<CourseDraft>({
    status: CourseStatus.Draft
  });

  initializeCourse(data: Partial<CourseDraft>): Observable<{ id: string }> {
    return this.http.post<ApiResponse<{ id: string }>>(ApiEndpoints.TeacherCourses.Draft(this.orgContext.requireActiveSlug()), data).pipe(
      map(response => response.data),
      tap(draftData => {
        this.state.update(s => ({ ...s, ...draftData, status: CourseStatus.Draft }));
      })
    );
  }

  updateIdentity(id: string, payload: Omit<UpdateCourseIdentityRequest, 'id'>): Observable<void> {
    const request: UpdateCourseIdentityRequest = { id, ...payload };
    return this.http.put<ApiResponse<CourseDraft>>(ApiEndpoints.TeacherCourses.UpdateIdentity(this.orgContext.requireActiveSlug(), id), request).pipe(
      map(() => void 0),
      tap(() => this.state.update(s => ({ ...s, ...payload })))
    );
  }

  updateCommercials(id: string, payload: Omit<UpdateCourseCommercialsRequest, 'id'>): Observable<void> {
    const request: UpdateCourseCommercialsRequest = { id, ...payload };
    return this.http.put<ApiResponse<CourseDraft>>(ApiEndpoints.TeacherCourses.UpdateCommercials(this.orgContext.requireActiveSlug(), id), request).pipe(
      map(() => void 0),
      tap(() => this.state.update(s => ({ ...s, ...payload })))
    );
  }

  updateMedia(id: string, payload: Omit<UpdateCourseMediaRequest, 'id'>): Observable<void> {
    const request: UpdateCourseMediaRequest = { id, ...payload };
    return this.http.put<ApiResponse<CourseDraft>>(ApiEndpoints.TeacherCourses.UpdateMedia(this.orgContext.requireActiveSlug(), id), request).pipe(
      map(() => void 0),
      tap(() => this.state.update(s => ({ ...s, ...payload })))
    );
  }

  /**
   * Saves the curriculum without losing ids. Sends the version that was loaded; the server answers 409 if
   * someone else saved in between. The returned draft (with new ids and version) replaces the local state.
   */
  syncCurriculum(id: string, chapters: CurriculumChapterInput[], syllabusRequirements?: string): Observable<CourseDraft> {
    const request: SyncCurriculumRequest = {
      expectedVersion: this.state().curriculumVersion ?? 0,
      syllabusRequirements,
      chapters,
    };
    return this.http.put<ApiResponse<CourseDraft>>(ApiEndpoints.TeacherCourses.UpdateCurriculum(this.orgContext.requireActiveSlug(), id), request).pipe(
      map(response => response.data),
      tap(draft => this.state.update(s => ({ ...s, ...draft })))
    );
  }

  /** What still blocks publishing; an empty list means the course is ready. */
  getPublishChecklist(id: string): Observable<string[]> {
    return this.http.get<ApiResponse<string[]>>(ApiEndpoints.TeacherCourses.PublishChecklist(this.orgContext.requireActiveSlug(), id)).pipe(
      map(response => response.data ?? [])
    );
  }

  /** Moves the course through its lifecycle; a 400 carries the publish checklist as errors. */
  changeStatus(id: string, status: CourseStatus): Observable<CourseDraft> {
    return this.http.put<ApiResponse<CourseDraft>>(ApiEndpoints.TeacherCourses.Status(this.orgContext.requireActiveSlug(), id), { status }).pipe(
      map(response => response.data),
      tap(draft => this.state.update(s => ({ ...s, status: draft.status })))
    );
  }

  getCourseDraft(id: string): Observable<CourseDraft> {
    return this.http.get<ApiResponse<CourseDraft>>(ApiEndpoints.TeacherCourses.GetDraft(this.orgContext.requireActiveSlug(), id)).pipe(
      map(response => response.data),
      tap(draft => {
        this.state.set(draft);
      })
    );
  }
}

