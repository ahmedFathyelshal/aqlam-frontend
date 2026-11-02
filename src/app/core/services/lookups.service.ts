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

@Injectable({
  providedIn: 'root'
})
export class LookupsService {
  private http = inject(HttpClient);

  getEducationStages(): Observable<LookupDto[]> {
    return this.http.get<ApiResponse<LookupDto[]>>(ApiEndpoints.Lookups.EducationStages).pipe(map(r => r.data));
  }

  getEducationGrades(stageId?: number): Observable<LookupDto[]> {
    return this.http.get<ApiResponse<LookupDto[]>>(ApiEndpoints.Lookups.EducationGrades(stageId)).pipe(map(r => r.data));
  }

  getSubjects(): Observable<LookupDto[]> {
    return this.http.get<ApiResponse<LookupDto[]>>(ApiEndpoints.Lookups.Subjects).pipe(map(r => r.data));
  }
}
