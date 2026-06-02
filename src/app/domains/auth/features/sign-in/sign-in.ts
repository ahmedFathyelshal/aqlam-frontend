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
  // Dependencies
  private router = inject(Router);
  private authService = inject(AuthService);

  // State
  public showAlert = signal<boolean>(false);
  public alertMessage = signal<string>('');
  public isSubmitting = signal<boolean>(false);
  
  protected signInFormModel = signal({
    userName: 'a.elshal',
    password: 'Aa@123456',
    rememberMe: false
  });
  
  protected signInForm = form(this.signInFormModel, (form) => {
    required(form.userName, { message: 'You must enter a username' });
    required(form.password, { message: 'You must enter a password' });
  });

  signIn(event: Event) {
    event.preventDefault();

    submit(this.signInForm, async () => {
      // Hide alert
      this.showAlert.set(false);
      this.isSubmitting.set(true);
      
      const formValue = this.signInFormModel();

      this.authService.signIn({
        userName: formValue.userName,
        password: formValue.password,
        deviceId: null // Based on the API expectation
      }).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          // Navigate to a route
          this.router.navigateByUrl('/admin/academy');
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
