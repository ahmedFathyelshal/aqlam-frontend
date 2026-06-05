import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, throwError, tap } from 'rxjs';
import { ApiResponse } from '../models/api-response.model';
import { ApiEndpoints } from '../constants/api-endpoints';
import { unwrapApiResponse } from '../utils/api-error.utils';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);

  // State
  public isAuthenticated = signal<boolean>(false);
  public user = signal<any>(null);

  /**
   * Sign in using username and password
   */
  signIn(credentials: any): Observable<any> {
    return this.http.post<ApiResponse<any>>(ApiEndpoints.Auth.Login, credentials).pipe(
      unwrapApiResponse(),
      tap(data => {
        // Since we use HttpOnly cookies, we don't save the token manually.
        // We update the auth state.
        this.isAuthenticated.set(true);
        if (data) {
          this.user.set(data);
        }
      })
    );
  }

  /**
   * Register a new user
   */
  signUp(data: any): Observable<any> {
    return this.http.post<ApiResponse<any>>(ApiEndpoints.Auth.Register, data).pipe(
      unwrapApiResponse()
    );
  }

  /**
   * Silently refresh the session using the HttpOnly refresh token cookie
   */
  refreshSession(deviceId: string | null = null): Observable<any> {
    return this.http.post<ApiResponse<any>>(ApiEndpoints.Auth.Refresh, { deviceId }).pipe(
      unwrapApiResponse(),
      tap(data => {
        this.isAuthenticated.set(true);
        if (data) {
          this.user.set(data);
        }
      })
    );
  }

  /**
   * Fetch the current user's profile on page load
   */
  getMe(): Observable<any> {
    return this.http.get<ApiResponse<any>>(ApiEndpoints.Auth.Me).pipe(
      unwrapApiResponse(),
      tap(data => {
        this.isAuthenticated.set(true);
        if (data) {
          this.user.set(data);
        }
      })
    );
  }

  /**
   * Clear local state (used when refresh fails)
   */
  signOutLocal(): void {
    this.isAuthenticated.set(false);
    this.user.set(null);
  }

  /**
   * Sign out
   */
  signOut(deviceId: string | null = null): Observable<any> {
    return this.http.post<ApiResponse<any>>(ApiEndpoints.Auth.Logout, { deviceId }).pipe(
      tap(() => {
        this.isAuthenticated.set(false);
        this.user.set(null);
      }),
      catchError(error => {
        this.isAuthenticated.set(false);
        this.user.set(null);
        return throwError(() => error);
      })
    );
  }
}
