import { Component, inject } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { AuthService } from '@/app/core/auth/auth.service';
import { OrgContextService } from '@/app/core/organizations/org-context.service';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'teacher-dashboard',
  standalone: true,
  imports: [TranslocoDirective, MatButtonModule, MatIconModule, MatRippleModule, RouterLink],
  templateUrl: './dashboard.component.html'
})
export default class TeacherDashboardComponent {
  public authService = inject(AuthService);
  protected orgContext = inject(OrgContextService);
  // Mock Data for the static dashboard
  recentCourses = [
    { id: 1, name: 'Advanced Mathematics', students: 45, status: 'Active', progress: 85 },
    { id: 2, name: 'Physics 101', students: 120, status: 'Draft', progress: 10 },
    { id: 3, name: 'Computer Science Basics', students: 300, status: 'Active', progress: 60 }
  ];

  upcomingSessions = [
    { id: 1, title: 'Calculus Q&A', time: '10:00 AM', date: 'Today' },
    { id: 2, title: 'Quantum Mechanics Intro', time: '02:00 PM', date: 'Tomorrow' },
  ];
}
