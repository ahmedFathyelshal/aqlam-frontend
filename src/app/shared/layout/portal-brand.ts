import { Injectable, signal } from '@angular/core';

export type PortalBrandInfo = { name: string; logoUrl: string | null };

/** Lets a page inside the portal shell show the school it belongs to in the header. */
@Injectable({ providedIn: 'root' })
export class PortalBrand {
  readonly current = signal<PortalBrandInfo | null>(null);
}
