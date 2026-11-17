import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';

export type DataRequest = { id: string; userName: string | null; type: 'Export' | 'Delete'; status: 'Open' | 'Completed' | 'Rejected'; note: string | null; createdAtUtc: string; handledAtUtc: string | null };

/** Acceptance of the terms and privacy texts, and requests about personal data. */
@Injectable({ providedIn: 'root' })
export class LegalService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  accept(): Observable<void> {
    return this.http.post(`${this.api}/me/legal/accept`, {}).pipe(map(() => void 0));
  }

  myRequests(): Observable<DataRequest[]> {
    return this.http.get<{ data: DataRequest[] }>(`${this.api}/me/data-requests`).pipe(map(r => r.data));
  }

  createRequest(type: 'Export' | 'Delete'): Observable<DataRequest> {
    return this.http.post<{ data: DataRequest }>(`${this.api}/me/data-requests`, { type }).pipe(map(r => r.data));
  }

  allRequests(status: string): Observable<DataRequest[]> {
    return this.http.get<{ data: DataRequest[] }>(`${this.api}/platform/data-requests?status=${encodeURIComponent(status)}`).pipe(map(r => r.data));
  }

  handle(id: string, completed: boolean, note: string | null): Observable<void> {
    return this.http.post(`${this.api}/platform/data-requests/${id}/handle`, { completed, note }).pipe(map(() => void 0));
  }
}
