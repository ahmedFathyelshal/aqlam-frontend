import { Component } from '@angular/core';
import { AqPortalShell, PortalNavItem } from '@/app/shared/layout/portal-shell';

/** Student area shell. */
@Component({
  selector: 'student-layout',
  imports: [AqPortalShell],
  template: `<aq-portal-shell [items]="items" />`,
})
export class StudentLayout {
  protected items: PortalNavItem[] = [{ key: 'nav.home', icon: 'house', link: '/student/dashboard' }];
}
