import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { environment } from '@/environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { FeaturedTeacher, Gender } from './marketplace.service';

const orgApi = (org: string, path: string) => `${environment.apiUrl}/orgs/${encodeURIComponent(org)}${path}`;
const api = (path: string) => `${environment.apiUrl}${path}`;

export type PublicProfile = {
  slug: string;
  publicName: string | null;
  headline: string | null;
  bio: string | null;
  city: string | null;
  gender: Gender | null;
  isListed: boolean;
  photoUrl: string | null;
  publicCourseCount: number;
  missingForListing: ('publicName' | 'gender' | 'publicCourse')[];
};

export type PublicProfileInput = {
  publicName: string | null;
  headline: string | null;
  bio: string | null;
  city: string | null;
  gender: Gender | null;
  isListed: boolean;
};

export type Money = { currency: string; gross: number; commission: number; providerFees: number; net: number };
export type Sale = { paymentId: string; paidAtUtc: string; courseTitle: string; studentName: string; amount: number; commission: number; net: number; currency: string };
export type MonthlyFee = { month: string; countedStudents: number; excludedBuyers: number; ratePerStudent: number | null; amount: number | null; currency: string };
export type Earnings = {
  organizationType: string;
  commissionPercent: number | null;
  totals: Money[];
  recentSales: Sale[];
  monthlyFee: MonthlyFee | null;
  currency: string;
};

export type CodeBatch = {
  id: string;
  courseId: string;
  courseTitle: string;
  name: string;
  quantity: number;
  redeemed: number;
  expiresAtUtc: string | null;
  createdAtUtc: string;
  cancelledAtUtc: string | null;
};
export type CreatedBatch = { batch: CodeBatch; codes: string[] };
export type CodeLookup = { status: 'Unused' | 'Used' | 'Cancelled' | 'Expired'; lastFour: string; batchId: string; batchName: string; redeemedByUserName: string | null; redeemedAtUtc: string | null };

export type Fees = { commissionPercent: number | null; monthlyStudentFeeSar: number | null; monthlyStudentFeeEgp: number | null };
export type AdminTeacher = { organizationId: string; slug: string; name: string; countryCode: string; courseCount: number };

/** Staff side of the marketplace: public page, earnings, activation codes; and the platform admin's picks and fees. */
@Injectable({ providedIn: 'root' })
export class TeacherBusinessService {
  private http = inject(HttpClient);

  profile(org: string): Observable<PublicProfile> {
    return this.http.get<ApiResponse<PublicProfile>>(orgApi(org, '/public-profile')).pipe(map(r => r.data));
  }

  saveProfile(org: string, input: PublicProfileInput): Observable<PublicProfile> {
    return this.http.put<ApiResponse<PublicProfile>>(orgApi(org, '/public-profile'), input).pipe(map(r => r.data));
  }

  uploadPhoto(org: string, file: File): Observable<PublicProfile> {
    const form = new FormData();
    form.append('file', file);
    return this.http.put<ApiResponse<PublicProfile>>(orgApi(org, '/public-profile/photo'), form).pipe(map(r => r.data));
  }

  removePhoto(org: string): Observable<PublicProfile> {
    return this.http.delete<ApiResponse<PublicProfile>>(orgApi(org, '/public-profile/photo')).pipe(map(r => r.data));
  }

  earnings(org: string): Observable<Earnings> {
    return this.http.get<ApiResponse<Earnings>>(orgApi(org, '/earnings')).pipe(map(r => r.data));
  }

  batches(org: string, courseId: string): Observable<CodeBatch[]> {
    return this.http.get<ApiResponse<CodeBatch[]>>(orgApi(org, `/courses/${courseId}/code-batches`)).pipe(map(r => r.data));
  }

  createBatch(org: string, courseId: string, input: { name: string; quantity: number; expiresAtUtc: string | null }): Observable<CreatedBatch> {
    return this.http.post<ApiResponse<CreatedBatch>>(orgApi(org, `/courses/${courseId}/code-batches`), input).pipe(map(r => r.data));
  }

  cancelBatch(org: string, courseId: string, batchId: string): Observable<CodeBatch> {
    return this.http.post<ApiResponse<CodeBatch>>(orgApi(org, `/courses/${courseId}/code-batches/${batchId}/cancel`), null).pipe(map(r => r.data));
  }

  lookup(org: string, courseId: string, code: string): Observable<CodeLookup> {
    return this.http
      .get<ApiResponse<CodeLookup>>(orgApi(org, `/courses/${courseId}/code-batches/lookup`), { params: { code } })
      .pipe(map(r => r.data));
  }

  // Platform admin
  fees(): Observable<Fees> {
    return this.http.get<ApiResponse<Fees>>(api('/platform/marketplace/fees')).pipe(map(r => r.data));
  }

  saveFees(fees: Fees): Observable<Fees> {
    return this.http.put<ApiResponse<Fees>>(api('/platform/marketplace/fees'), fees).pipe(map(r => r.data));
  }

  featuredPicks(): Observable<FeaturedTeacher[]> {
    return this.http.get<ApiResponse<FeaturedTeacher[]>>(api('/platform/marketplace/featured')).pipe(map(r => r.data));
  }

  listedTeachers(q: string): Observable<AdminTeacher[]> {
    return this.http.get<ApiResponse<AdminTeacher[]>>(api('/platform/marketplace/teachers'), { params: { q } }).pipe(map(r => r.data));
  }

  feature(slug: string, subjectId: number | null, order: number): Observable<FeaturedTeacher> {
    return this.http.post<ApiResponse<FeaturedTeacher>>(api('/platform/marketplace/featured'), { slug, subjectId, order }).pipe(map(r => r.data));
  }

  unfeature(id: string): Observable<unknown> {
    return this.http.delete(api(`/platform/marketplace/featured/${id}`));
  }
}
