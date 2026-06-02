import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { ApiResponse } from '../models/api-response.model';
import { ApiEndpoints } from '../constants/api-endpoints';

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
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.errors?.length ? response.errors.join(', ') : 'Login failed');
        }
        
        // Since we use HttpOnly cookies, we don't save the token manually.
        // We update the auth state.
        this.isAuthenticated.set(true);
        if (response.data) {
          this.user.set(response.data);
        }
        
        return response.data;
      }),
      catchError(error => {
        let errorMsg = 'An unknown error occurred during login.';
        if (error instanceof Error) {
          errorMsg = error.message;
        } else if (error.error && error.error.errors && Array.isArray(error.error.errors)) {
          errorMsg = error.error.errors.join(', ');
        } else if (error.status === 401) {
          errorMsg = 'Invalid username or password.';
        } else if (error.message) {
          errorMsg = error.message;
        }
        return throwError(() => new Error(errorMsg));
      })
    );
  }

  /**
   * Sign out
   */
  signOut(): Observable<any> {
    this.isAuthenticated.set(false);
    this.user.set(null);
    return new Observable(subscriber => {
      subscriber.next(true);
      subscriber.complete();
    });
  }
}
