import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Router } from '@angular/router';
import { interval, startWith, switchMap, catchError, EMPTY } from 'rxjs';

import { formatOrgDate } from '@/app/core/organizations/org-date';
import { AppNotification, NotificationService } from '@/app/core/school/family.service';

/** Header bell with the user's notifications (announcements, absence alerts). Polls every minute. */
@Component({
  selector: 'notification-bell',
  imports: [MatBadgeModule, MatButtonModule, MatIconModule, MatMenuModule],
  template: `
    <button
      matIconButton
      aria-label="Notifications"
      [matMenuTriggerFor]="menu"
      [matBadge]="inbox.unreadCount() || null"
      matBadgeColor="warn"
      matBadgeSize="small"
    >
      <mat-icon svgIcon="bell" />
    </button>

    <mat-menu #menu="matMenu" class="w-96 max-w-[90vw]" xPosition="before">
      <div class="flex items-center justify-between px-4 py-2" (click)="$event.stopPropagation()">
        <span class="font-semibold">Notifications</span>
        @if (inbox.unreadCount()) {
          <button matButton class="small" (click)="markAll()">Mark all read</button>
        }
      </div>
      @for (n of inbox.items(); track n.id) {
        <button mat-menu-item class="!h-auto !py-2" (click)="open(n)">
          <div class="flex flex-col whitespace-normal" [class.opacity-60]="n.isRead">
            <span class="text-sm font-medium">{{ n.title }}</span>
            <span class="line-clamp-2 text-xs text-neutral-500">{{ n.body }}</span>
            <span class="text-2xs text-neutral-400">{{ n.organizationName }} · {{ date(n.createdAtUtc) }}</span>
          </div>
        </button>
      } @empty {
        <p class="px-4 py-6 text-center text-sm text-neutral-500">You're all caught up.</p>
      }
    </mat-menu>
  `,
})
export class NotificationBell implements OnInit {
  protected inbox = inject(NotificationService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    interval(60_000)
      .pipe(
        startWith(0),
        switchMap(() => this.inbox.refresh().pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  protected open(notification: AppNotification): void {
    this.inbox.markRead(notification).subscribe();
    if (notification.link) this.router.navigateByUrl(notification.link);
  }

  protected markAll(): void {
    this.inbox.markAllRead().subscribe();
  }

  protected date(value: string): string {
    return formatOrgDate(value, 'Gregorian', { style: 'datetime' });
  }
}
