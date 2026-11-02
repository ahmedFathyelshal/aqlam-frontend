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
  UpdateCourseCurriculumRequest,
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

  updateChapters(id: string, chapters: any[], syllabusRequirements?: string): Observable<void> {
    const request: UpdateCourseCurriculumRequest = { id, chapters, syllabusRequirements };
    return this.http.put<ApiResponse<CourseDraft>>(ApiEndpoints.TeacherCourses.UpdateCurriculum(this.orgContext.requireActiveSlug(), id), request).pipe(
      map(() => void 0),
      tap(() => this.state.update(s => ({ ...s, chapters, syllabusRequirements })))
    );
  }

  publishCourse(id: string): Observable<void> {
    // Currently mocked as there's no backend endpoint yet
    return new Observable<void>(obs => {
      this.state.update(s => ({ ...s, status: CourseStatus.Published }));
      obs.next();
      obs.complete();
    });
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

