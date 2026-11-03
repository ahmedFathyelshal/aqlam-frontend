import { Component } from '@angular/core';
import { AqPortalShell, PortalNavItem } from '@/app/shared/layout/portal-shell';

/** Parent portal shell. */
@Component({
  selector: 'parent-layout',
  imports: [AqPortalShell],
  template: `<aq-portal-shell [items]="items" />`,
})
export class ParentLayout {
  protected items: PortalNavItem[] = [{ key: 'nav.children', icon: 'users-round', link: '/parent', exact: true }];
}
