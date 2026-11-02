import { Component, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  required,
  submit,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDivider } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@/app/core/auth/auth.service';

type LoginStep = 'username' | 'password';

@Component({
  selector: 'auth-sign-in',
  templateUrl: './sign-in.html',
  imports: [
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    FormField,
    MatDivider,
  ],
})
export default class AuthSignIn {
  private router = inject(Router);
  private authService = inject(AuthService);

  // Username-First two-step flow
  public step = signal<LoginStep>('username');

  public showAlert = signal<boolean>(false);
  public alertMessage = signal<string>('');
  public isCheckingUsername = signal<boolean>(false);
  public isSubmitting = signal<boolean>(false);

  protected signInFormModel = signal({
    userName: '',
    password: '',
    rememberMe: false
  });

  protected usernameForm = form(
    this.signInFormModel,
    (form) => {
      required(form.userName, { message: 'You must enter a username' });
    }
  );

  protected passwordForm = form(
    this.signInFormModel,
    (form) => {
      required(form.password, { message: 'You must enter a password' });
    }
  );

  continueToPassword(event: Event) {
    event.preventDefault();
    this.showAlert.set(false);

    submit(this.usernameForm, async () => {
      this.step.set('password');
    });
  }

  backToUsername() {
    this.showAlert.set(false);
    this.step.set('username');
  }

  signIn(event: Event) {
    event.preventDefault();
    this.showAlert.set(false);

    submit(this.passwordForm, async () => {
      this.isSubmitting.set(true);

      const formValue = this.signInFormModel();

      this.authService.signIn({
        userName: formValue.userName,
        password: formValue.password
      }).subscribe({
        next: () => {
          this.isSubmitting.set(false);

          const user = this.authService.user();
          if (user?.roles?.includes('Teacher')) {
            this.router.navigateByUrl('/teacher');
          } else if (user?.roles?.includes('Student')) {
            this.router.navigateByUrl('/student/dashboard');
          } else {
            this.router.navigateByUrl('/admin/academy');
          }
        },
        error: (error) => {
          this.isSubmitting.set(false);
          this.alertMessage.set(error.message);
          this.showAlert.set(true);
        }
      });
    });
  }
}
