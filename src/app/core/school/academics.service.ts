import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { ApiEndpoints } from '../constants/api-endpoints';
import { ApiResponse } from '../models/api-response.model';

export type GradingScale = 'Percent' | 'Letters' | 'Descriptive';

export type AcademicTerm = { id: string; name: string; order: number; startDate: string; endDate: string; reportCardsPublished: boolean };
export type AcademicYear = { id: string; name: string; startDate: string; endDate: string; isCurrent: boolean; terms: AcademicTerm[] };
export type AcademicTermInput = { id: string | null; name: string; startDate: string; endDate: string };
export type AcademicYearInput = { name: string; startDate: string; endDate: string; terms: AcademicTermInput[] };

export type GradeItem = { id: string; title: string; maxPoints: number; source: 'Manual' | 'Quiz' | 'Assignment'; sourceLessonId: string | null };
export type GradeCategory = { id: string; name: string; weightPercent: number; items: GradeItem[] };
export type GradeCell = { itemId: string; score: number; fromLesson: boolean };
export type GradeRow = {
  userId: string;
  userName: string;
  fullName: string;
  cells: GradeCell[];
  categoryPercents: Record<string, number | null>;
  finalPercent: number | null;
  label: string | null;
};
export type LinkableLesson = { lessonId: string; title: string; type: 'Quiz' | 'Assignment' };
export type Gradebook = {
  classId: string;
  className: string;
  assignmentId: string;
  subjectName: string;
  termId: string;
  termName: string;
  scale: GradingScale;
  weightsTotal: number;
  categories: GradeCategory[];
  students: GradeRow[];
  linkableLessons: LinkableLesson[];
};

export type ReportCard = {
  userId: string;
  studentName: string;
  organizationName: string;
  logoUrl: string | null;
  yearName: string;
  termId: string;
  termName: string;
  termStart: string;
  termEnd: string;
  published: boolean;
  classes: string[];
  scale: GradingScale;
  subjects: {
    subjectName: string;
    teacherName: string | null;
    categories: { name: string; weightPercent: number; percent: number | null }[];
    finalPercent: number | null;
    label: string | null;
  }[];
  overallPercent: number | null;
  overallLabel: string | null;
  attendance: { present: number; absent: number; late: number; excused: number };
};

export type PublishedTerm = { termId: string; termName: string; yearName: string };

/** The term to open by default: today's term of the current year, else that year's first, else any. */
export function defaultTerm(years: AcademicYear[], today: string): AcademicTerm | null {
  const year = years.find(y => y.isCurrent) ?? years[0];
  if (!year) return null;
  return year.terms.find(t => t.startDate <= today && today <= t.endDate) ?? year.terms[0] ?? null;
}

/** Saves a file the API returned, under the given name. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Academic years, gradebooks and report cards. */
@Injectable({ providedIn: 'root' })
export class AcademicsService {
  private http = inject(HttpClient);

  // ---- years -------------------------------------------------------------------------------------------
  years(org: string): Observable<AcademicYear[]> {
    return this.get(ApiEndpoints.Academics.Years(org));
  }

  saveYear(org: string, id: string | null, input: AcademicYearInput): Observable<AcademicYear> {
    return id ? this.put(ApiEndpoints.Academics.Year(org, id), input) : this.post(ApiEndpoints.Academics.Years(org), input);
  }

  deleteYear(org: string, id: string): Observable<boolean> {
    return this.del(ApiEndpoints.Academics.Year(org, id));
  }

  setCurrent(org: string, id: string): Observable<AcademicYear> {
    return this.post(ApiEndpoints.Academics.YearCurrent(org, id), null);
  }

  setPublished(org: string, termId: string, published: boolean): Observable<AcademicTerm> {
    return this.put(ApiEndpoints.Academics.TermReportCards(org, termId), { published });
  }

  // ---- gradebook ---------------------------------------------------------------------------------------
  gradebook(org: string, classId: string, assignmentId: string, termId: string): Observable<Gradebook> {
    return this.get(`${ApiEndpoints.Academics.Gradebook(org, classId, assignmentId)}?termId=${termId}`);
  }

  saveCategory(org: string, classId: string, assignmentId: string, id: string | null, body: { termId: string; name: string; weightPercent: number }): Observable<GradeCategory> {
    const base = `${ApiEndpoints.Academics.Gradebook(org, classId, assignmentId)}/categories`;
    return id ? this.put(`${base}/${id}`, body) : this.post(base, body);
  }

  deleteCategory(org: string, classId: string, assignmentId: string, id: string): Observable<boolean> {
    return this.del(`${ApiEndpoints.Academics.Gradebook(org, classId, assignmentId)}/categories/${id}`);
  }

  saveItem(org: string, classId: string, assignmentId: string, categoryId: string, id: string | null, body: { title: string; maxPoints: number; sourceLessonId: string | null }): Observable<GradeItem> {
    const base = `${ApiEndpoints.Academics.Gradebook(org, classId, assignmentId)}/categories/${categoryId}/items`;
    return id ? this.put(`${base}/${id}`, body) : this.post(base, body);
  }

  deleteItem(org: string, classId: string, assignmentId: string, id: string): Observable<boolean> {
    return this.del(`${ApiEndpoints.Academics.Gradebook(org, classId, assignmentId)}/items/${id}`);
  }

  saveScore(org: string, classId: string, assignmentId: string, itemId: string, userId: string, score: number | null): Observable<boolean> {
    return this.put(`${ApiEndpoints.Academics.Gradebook(org, classId, assignmentId)}/items/${itemId}/scores`, { scores: [{ userId, score }] });
  }

  exportGradebook(org: string, classId: string, assignmentId: string, termId: string): Observable<Blob> {
    return this.http.get(`${ApiEndpoints.Academics.Gradebook(org, classId, assignmentId)}/export?termId=${termId}`, { responseType: 'blob' });
  }

  // ---- report cards ------------------------------------------------------------------------------------
  staffReportCard(org: string, studentId: string, termId: string): Observable<ReportCard> {
    return this.get(`${ApiEndpoints.Academics.ReportCard(org, studentId, termId)}/staff`);
  }

  familyReportCard(org: string, studentId: string, termId: string): Observable<ReportCard> {
    return this.get(ApiEndpoints.Academics.ReportCard(org, studentId, termId));
  }

  publishedTerms(org: string, studentId: string): Observable<PublishedTerm[]> {
    return this.get(ApiEndpoints.Academics.PublishedTerms(org, studentId));
  }

  private get<T>(url: string): Observable<T> {
    return this.http.get<ApiResponse<T>>(url).pipe(map(r => r.data));
  }

  private post<T>(url: string, body: unknown): Observable<T> {
    return this.http.post<ApiResponse<T>>(url, body).pipe(map(r => r.data));
  }

  private put<T>(url: string, body: unknown): Observable<T> {
    return this.http.put<ApiResponse<T>>(url, body).pipe(map(r => r.data));
  }

  private del<T>(url: string): Observable<T> {
    return this.http.delete<ApiResponse<T>>(url).pipe(map(r => r.data));
  }
}
