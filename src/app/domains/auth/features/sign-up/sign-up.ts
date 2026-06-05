import { Component, inject, signal } from '@angular/core';
import {
  email,
  form,
  FormField,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { Router, RouterLink } from '@angular/router';
import { UserType } from '../../../../core/models/user-type.enum';
import { AlertBannerComponent } from '../../../../shared/components/alert-banner/alert-banner.component';
import { ApiValidationError } from '../../../../core/utils/api-error.utils';
import { AuthService } from '@/app/core/auth/auth.service';


@Component({
  selector: 'auth-sign-up',
  templateUrl: './sign-up.html',
  imports: [
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    AlertBannerComponent,
    FormField,
  ],
})
export default class AuthSignUp {
  // Dependencies
  private router = inject(Router);
  private authService = inject(AuthService);

  // State
  isSubmitting = signal(false);
  showAlert = signal<boolean>(false);
  alertMessages = signal<string[]>([]);

  // State
  protected signUpFormModel = signal({
    userName: '',
    email: '',
    password: '',
    confirmPassword: '',
    userType: UserType.Student,
  });
  protected signUpForm = form(this.signUpFormModel, (form) => {
    required(form.userName, { message: 'You must enter your username' });
    required(form.email, { message: 'You must enter an email address' });
    email(form.email, { message: 'You must enter a valid email address' });
    required(form.password, { message: 'You must enter a password' });
    required(form.confirmPassword, { message: 'You must confirm your password' });
    validate(form.confirmPassword, (ctx) => {
      if (ctx.value() !== this.signUpFormModel().password) {
        return { kind: 'passwordMismatch', message: 'Passwords do not match' };
      }
      return null;
    });
  });

  signUp(event: Event) {
    event.preventDefault();

    submit(this.signUpForm, async () => {
      this.isSubmitting.set(true);
      this.showAlert.set(false);

      this.authService.signUp(this.signUpFormModel()).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.router.navigateByUrl('/auth/sign-in');
        },
        error: (error) => {
          this.isSubmitting.set(false);
          if (error instanceof ApiValidationError) {
            this.alertMessages.set(error.errors);
          } else {
            // Unhandled unexpected errors, already toast-handled by interceptor
            this.alertMessages.set(['An unexpected error occurred. Please try again.']);
          }
          this.showAlert.set(true);
        }
      });
    });
  }
}
