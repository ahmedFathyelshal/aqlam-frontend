import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { environment } from '@/environments/environment';
import { ApiResponse } from '../models/api-response.model';

const api = (path: string) => `${environment.apiUrl}${path}`;
const orgApi = (org: string, path: string) => api(`/orgs/${encodeURIComponent(org)}${path}`);

export type Gender = 'Male' | 'Female';

export type CourseCard = {
  slug: string;
  title: string;
  subtitle: string | null;
  thumbnailUrl: string | null;
  organizationName: string;
  organizationType: 'Personal' | 'Center';
  /** Empty when the teacher has not set a public name: show "independent teacher". */
  teacherName: string;
  teacherSlug: string | null;
  countryCode: string;
  currency: string;
  isFree: boolean;
  price: number | null;
  codeActivationOnly: boolean;
  isComingSoon: boolean;
  lessonCount: number;
  totalMinutes: number;
  freePreviewCount: number;
  curriculumId: number | null;
  gradeId: number | null;
  subjectId: number | null;
};

export type TeacherCard = {
  slug: string;
  name: string;
  headline: string | null;
  city: string | null;
  countryCode: string;
  gender: Gender;
  photoUrl: string | null;
  subjectIds: number[];
  gradeIds: number[];
  courseCount: number;
};

export type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };
export type CountItem = { id: number; count: number };
export type Facets = { subjects: CountItem[]; grades: CountItem[]; curricula: CountItem[]; courses: number; teachers: number };
export type FeaturedTeacher = { id: string; subjectId: number | null; order: number; teacher: TeacherCard };
export type TeacherPage = { teacher: TeacherCard; bio: string | null; courses: CourseCard[] };

export type OutlineLesson = { id: string; title: string; type: 'Video' | 'Article' | 'Quiz' | 'Assignment'; durationInMinutes: number | null; isFreePreview: boolean };
export type OutlineChapter = { title: string; lessons: OutlineLesson[] };
export type CourseViewer = { signedIn: boolean; enrolled: boolean; isStaff: boolean; hasPendingPayment: boolean };

export type CoursePage = {
  course: CourseCard;
  courseId: string;
  organizationSlug: string;
  promoVideoUrl: string | null;
  syllabusRequirements: string | null;
  accessExpiryPolicy: 'Unlimited' | 'Limited' | string;
  accessDurationDays: number | null;
  chapters: OutlineChapter[];
  teacher: TeacherCard | null;
  onlinePaymentAvailable: boolean;
  viewer: CourseViewer;
};

export type PreviewLesson = {
  id: string;
  title: string;
  type: OutlineLesson['type'];
  videoUrl: string | null;
  summary: string | null;
  content: string | null;
  durationInMinutes: number | null;
};

export type SearchFilters = {
  q?: string | null;
  country?: string | null;
  curriculumId?: number | null;
  gradeId?: number | null;
  subjectId?: number | null;
  teacherGender?: Gender | null;
  free?: boolean | null;
  page?: number;
  pageSize?: number;
};

export type Checkout = { paymentId: string; status: string; redirectUrl: string; amount: number; currency: string };
export type PaymentStatus = {
  paymentId: string;
  status: 'Pending' | 'Succeeded' | 'Failed';
  courseTitle: string;
  amount: number;
  currency: string;
  organizationSlug: string;
  courseId: string;
  coursePublicSlug: string | null;
  failureReason: string | null;
};
export type Redeemed = { organizationSlug: string; courseId: string; courseTitle: string };

/** The Saudi admission tests (grades under the "admission tests" curriculum), story 3.5.2. */
export const TEST_PREP = {
  qudrat: { gradeId: 204, curriculumId: 10 },
  tahsili: { gradeId: 205, curriculumId: 10 },
} as const;
export type TestPrepKey = keyof typeof TEST_PREP;

function params(filters: SearchFilters): HttpParams {
  let p = new HttpParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== null && value !== undefined && value !== '') p = p.set(key, String(value));
  }
  return p;
}

/** Public marketplace (no sign-in needed), checkout and activation codes. */
@Injectable({ providedIn: 'root' })
export class MarketplaceService {
  private http = inject(HttpClient);

  courses(filters: SearchFilters): Observable<Paged<CourseCard>> {
    return this.http.get<ApiResponse<Paged<CourseCard>>>(api('/marketplace/courses'), { params: params(filters) }).pipe(map(r => r.data));
  }

  teachers(filters: SearchFilters): Observable<Paged<TeacherCard>> {
    const { free: _free, ...rest } = filters;
    return this.http.get<ApiResponse<Paged<TeacherCard>>>(api('/marketplace/teachers'), { params: params(rest) }).pipe(map(r => r.data));
  }

  facets(country?: string | null): Observable<Facets> {
    return this.http.get<ApiResponse<Facets>>(api('/marketplace/facets'), { params: params({ country }) }).pipe(map(r => r.data));
  }

  featured(country?: string | null, subjectId?: number | null): Observable<FeaturedTeacher[]> {
    return this.http.get<ApiResponse<FeaturedTeacher[]>>(api('/marketplace/featured'), { params: params({ country, subjectId }) }).pipe(map(r => r.data));
  }

  teacher(slug: string): Observable<TeacherPage> {
    return this.http.get<ApiResponse<TeacherPage>>(api(`/marketplace/teachers/${encodeURIComponent(slug)}`)).pipe(map(r => r.data));
  }

  course(slug: string): Observable<CoursePage> {
    return this.http.get<ApiResponse<CoursePage>>(api(`/marketplace/courses/${encodeURIComponent(slug)}`)).pipe(map(r => r.data));
  }

  preview(slug: string, lessonId: string): Observable<PreviewLesson> {
    return this.http.get<ApiResponse<PreviewLesson>>(api(`/marketplace/courses/${encodeURIComponent(slug)}/lessons/${lessonId}`)).pipe(map(r => r.data));
  }

  enroll(org: string, courseId: string): Observable<unknown> {
    return this.http.post(orgApi(org, `/learn/courses/${courseId}/enroll`), null);
  }

  checkout(org: string, courseId: string): Observable<Checkout> {
    return this.http.post<ApiResponse<Checkout>>(orgApi(org, `/learn/courses/${courseId}/checkout`), null).pipe(map(r => r.data));
  }

  payment(id: string): Observable<PaymentStatus> {
    return this.http.get<ApiResponse<PaymentStatus>>(api(`/payments/${id}`)).pipe(map(r => r.data));
  }

  completeTestPayment(id: string, succeed: boolean): Observable<PaymentStatus> {
    return this.http.post<ApiResponse<PaymentStatus>>(api(`/payments/${id}/test-complete`), { succeed }).pipe(map(r => r.data));
  }

  redeem(code: string, courseId?: string | null): Observable<Redeemed> {
    return this.http.post<ApiResponse<Redeemed>>(api('/codes/redeem'), { code, courseId: courseId ?? null }).pipe(map(r => r.data));
  }
}

/** XXXX-XXXX-XXXX while typing; Arabic-Indic digits become Western; letters upper case. */
export function formatCode(input: string): string {
  const clean = input
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06f0))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
  return clean.match(/.{1,4}/g)?.join('-') ?? '';
}

/** "SAR 200" style amounts in the reader's language, Western digits. */
export function formatPrice(amount: number, currency: string, lang: string): string {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}
