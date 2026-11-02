import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, switchMap, tap } from 'rxjs';
import { ApiEndpoints } from '../constants/api-endpoints';
import { ApiResponse } from '../models/api-response.model';
import { OrgContextService } from '../organizations/org-context.service';
import { unwrapApiResponse } from '../utils/api-error.utils';

/** Profile returned by login, refresh and /me. Tokens never reach JavaScript (HttpOnly cookies). */
export type AuthUser = {
  id: string;
  userName: string;
  name: string;
  email?: string | null;
  roles: string[];
}

export type SignInRequest = {
  userName: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private orgContext = inject(OrgContextService);

  // State
  public isAuthenticated = signal<boolean>(false);
  public user = signal<AuthUser | null>(null);

  /**
   * Sign in using username and password. The response carries the profile directly.
   */
  signIn(credentials: SignInRequest): Observable<AuthUser> {
    return this.http.post<ApiResponse<AuthUser>>(ApiEndpoints.Auth.Login, credentials).pipe(
      unwrapApiResponse(),
      tap(user => this.setUser(user)),
      switchMap(user => this.loadOrganizations(user))
    );
  }

  /**
   * Register a new user
   */
  signUp(data: object): Observable<unknown> {
    return this.http.post<ApiResponse<unknown>>(ApiEndpoints.Auth.Register, data).pipe(
      unwrapApiResponse()
    );
  }

  /**
   * Silently refresh the session using the HttpOnly refresh token cookie.
   * The device id is a server-managed cookie, so nothing is sent in the body.
   */
  refreshSession(): Observable<AuthUser> {
    return this.http.post<ApiResponse<AuthUser>>(ApiEndpoints.Auth.Refresh, {}).pipe(
      unwrapApiResponse(),
      tap(user => this.setUser(user))
    );
  }

  /**
   * Fetch the current user's profile on page load
   */
  getMe(): Observable<AuthUser> {
    return this.http.get<ApiResponse<AuthUser>>(ApiEndpoints.Auth.Me).pipe(
      unwrapApiResponse(),
      tap(user => this.setUser(user)),
      switchMap(user => this.loadOrganizations(user))
    );
  }

  /**
   * Clear local state (used when refresh fails)
   */
  signOutLocal(): void {
    this.isAuthenticated.set(false);
    this.user.set(null);
    this.orgContext.clear();
  }

  /**
   * Sign out. Local state is cleared whether or not the server call succeeds.
   */
  signOut(): Observable<void> {
    return this.http.post<ApiResponse<boolean>>(ApiEndpoints.Auth.Logout, {}).pipe(
      map(() => void 0),
      catchError(() => of(void 0)),
      finalize(() => this.signOutLocal())
    );
  }

  /** Loads the user's organizations; a failure here must not block sign-in. */
  private loadOrganizations(user: AuthUser): Observable<AuthUser> {
    return this.orgContext.load().pipe(
      map(() => user),
      catchError(() => of(user))
    );
  }

  private setUser(user: AuthUser | null | undefined): void {
    if (user) {
      this.user.set(user);
      this.isAuthenticated.set(true);
    }
  }
}
