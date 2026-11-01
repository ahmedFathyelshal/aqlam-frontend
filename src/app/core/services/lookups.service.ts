import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiResponse } from '../models/api-response.model';
import { ApiEndpoints } from '../constants/api-endpoints';

export interface LookupDto {
  id: number;
  nameEn: string;
  nameAr: string;
}

export interface CurriculumDto extends LookupDto {
  code: string;
  countryCode: string | null;
  kind: 'National' | 'International' | 'TestPrep';
}

@Injectable({
  providedIn: 'root'
})
export class LookupsService {
  private http = inject(HttpClient);

  /** National curricula of the country first, then international ones. */
  getCurricula(countryCode?: string): Observable<CurriculumDto[]> {
    return this.http.get<ApiResponse<CurriculumDto[]>>(ApiEndpoints.Lookups.Curricula(countryCode)).pipe(map(r => r.data));
  }

  getEducationStages(curriculumId?: number): Observable<LookupDto[]> {
    return this.http.get<ApiResponse<LookupDto[]>>(ApiEndpoints.Lookups.EducationStages(curriculumId)).pipe(map(r => r.data));
  }

  getEducationGrades(stageId?: number): Observable<LookupDto[]> {
    return this.http.get<ApiResponse<LookupDto[]>>(ApiEndpoints.Lookups.EducationGrades(stageId)).pipe(map(r => r.data));
  }

  getSubjects(): Observable<LookupDto[]> {
    return this.http.get<ApiResponse<LookupDto[]>>(ApiEndpoints.Lookups.Subjects).pipe(map(r => r.data));
  }
}
