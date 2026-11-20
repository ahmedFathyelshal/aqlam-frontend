import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';

export type DataRequest = { id: string; userId: string; userName: string | null; type: 'Export' | 'Delete'; status: 'Open' | 'Completed' | 'Rejected'; note: string | null; createdAtUtc: string; handledAtUtc: string | null };

function saveJson(data: unknown, fileName: string): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

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

  /** Downloads a JSON copy of the account's data (own account, or any account for a platform admin). */
  downloadData(userId: string | null): Observable<void> {
    const url = userId ? `${this.api}/platform/users/${userId}/export` : `${this.api}/me/data-export`;
    return this.http.get<{ data: unknown }>(url).pipe(map(r => saveJson(r.data, userId ? `aqlam-data-${userId.slice(0, 8)}.json` : 'aqlam-my-data.json')));
  }

  deleteAccount(userId: string): Observable<void> {
    return this.http.post(`${this.api}/platform/users/${userId}/delete`, {}).pipe(map(() => void 0));
  }

  allRequests(status: string): Observable<DataRequest[]> {
    return this.http.get<{ data: DataRequest[] }>(`${this.api}/platform/data-requests?status=${encodeURIComponent(status)}`).pipe(map(r => r.data));
  }

  handle(id: string, completed: boolean, note: string | null): Observable<void> {
    return this.http.post(`${this.api}/platform/data-requests/${id}/handle`, { completed, note }).pipe(map(() => void 0));
  }
}
