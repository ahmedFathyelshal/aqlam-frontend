import { Component } from '@angular/core';
import { AqPortalShell, PortalNavItem } from '@/app/shared/layout/portal-shell';

/** Student area shell. */
@Component({
  selector: 'student-layout',
  imports: [AqPortalShell],
  template: `<aq-portal-shell [items]="items" />`,
})
export class StudentLayout {
  protected items: PortalNavItem[] = [
    { key: 'nav.home', icon: 'house', link: '/student/dashboard' },
    { key: 'nav.subjects', icon: 'book-open', link: '/student/dashboard', fragment: 'subjects' },
    { key: 'nav.results', icon: 'award', link: '/student/dashboard', fragment: 'results' },
  ];
}
