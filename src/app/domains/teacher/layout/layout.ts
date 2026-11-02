import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BidiModule } from '@angular/cdk/bidi';
import {
  MatSidenav,
  MatSidenavContainer,
  MatSidenavContent,
} from '@angular/material/sidenav';
import { RouterOutlet } from '@angular/router';
import { Media } from '@/app/core/media';
import { LanguageSwitcher } from '@/app/domains/admin/layout/ui/language-switcher';
import { SchemeSwitcher } from '@/app/domains/admin/layout/ui/scheme-switcher';
import { I18nService } from '@/app/core/transloco/i18n.service';
import { NotificationBell } from '@/app/shared/components/notification-bell/notification-bell';
import { OrgSwitcher } from './org-switcher';
import { StaffSidebar } from './staff-sidebar';

@Component({
  selector: 'teacher-layout',
  imports: [
    MatIconModule,
    MatButtonModule,
    BidiModule,
    RouterOutlet,
    MatSidenavContainer,
    MatSidenav,
    MatSidenavContent,
    StaffSidebar,
    SchemeSwitcher,
    NotificationBell,
    LanguageSwitcher,
    OrgSwitcher,
  ],
  templateUrl: './layout.html',
})
export class TeacherLayout {
  private media = inject(Media);
  public i18n = inject(I18nService);

  protected isMobile = computed(() =>
    this.media.match(`(max-width: 1023px)`)()
  );
}
