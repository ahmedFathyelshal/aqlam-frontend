import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterOutlet, RouterLink } from '@angular/router';
import { LanguageSwitcher } from '@/app/domains/admin/layout/ui/language-switcher';
import { NotificationBell } from '@/app/shared/components/notification-bell/notification-bell';
import { SchemeSwitcher } from '@/app/domains/admin/layout/ui/scheme-switcher';
import { User } from '@/app/domains/admin/layout/ui/user';

@Component({
  selector: 'student-layout',
  imports: [
    MatIconModule,
    MatButtonModule,
    RouterOutlet,
    RouterLink,
    SchemeSwitcher,
    NotificationBell,
    LanguageSwitcher,
    User,
  ],
  templateUrl: './layout.html',
})
export class StudentLayout {}
