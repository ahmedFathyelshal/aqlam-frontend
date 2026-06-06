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
import { Notifications } from '@/app/domains/admin/layout/ui/notifications';
import { SchemeSwitcher } from '@/app/domains/admin/layout/ui/scheme-switcher';
import { AdminSidebar } from '@/app/domains/admin/layout/ui/sidebar';
import { I18nService } from '@/app/core/transloco/i18n.service';

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
    AdminSidebar,
    SchemeSwitcher,
    Notifications,
    LanguageSwitcher,
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
