import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { catchError, EMPTY, interval, startWith, switchMap } from 'rxjs';

import { formatOrgDate } from '@/app/core/organizations/org-date';
import { AppNotification, NotificationService } from '@/app/core/school/family.service';
import { I18nService } from '@/app/core/transloco/i18n.service';

/** Header bell with the user's notifications (announcements, absence alerts). Polls every minute. */
@Component({
  selector: 'notification-bell',
  imports: [MatIconModule, MatMenuModule, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <button type="button" class="btn-icon relative" [attr.aria-label]="t('notifications.title')" [matMenuTriggerFor]="menu">
        <mat-icon svgIcon="bell" class="icon-size-5" />
        @if (inbox.unreadCount()) {
          <span class="absolute -top-1 -end-1 min-w-5 rounded-full bg-danger-700 px-1 text-center text-xs leading-5 font-extrabold text-white">
            {{ inbox.unreadCount() > 9 ? '9+' : inbox.unreadCount() }}
          </span>
        }
      </button>

      <mat-menu #menu="matMenu" xPosition="before" class="w-[22rem] max-w-[92vw]">
        <div class="flex items-center justify-between gap-2 border-b border-line-soft px-4 py-2" (click)="$event.stopPropagation()">
          <span class="font-extrabold">{{ t('notifications.title') }}</span>
          @if (inbox.unreadCount()) {
            <button type="button" class="btn btn-ghost btn-sm" (click)="markAll()">{{ t('notifications.markAll') }}</button>
          }
        </div>
        @for (n of inbox.items(); track n.id) {
          <button mat-menu-item class="!h-auto !py-2.5" (click)="open(n)">
            <span class="flex items-start gap-2 whitespace-normal">
              <span class="mt-2 size-2 shrink-0 rounded-full" [class]="n.isRead ? 'bg-transparent' : dotColor(n)"></span>
              <span class="flex flex-col" [class.opacity-70]="n.isRead">
                <span class="text-[0.95rem] font-bold">{{ n.title }}</span>
                <span class="line-clamp-2 text-sm text-muted">{{ n.body }}</span>
                <span class="text-xs text-muted">{{ n.organizationName }} · {{ date(n.createdAtUtc) }}</span>
              </span>
            </span>
          </button>
        } @empty {
          <p class="px-4 py-8 text-center text-muted">{{ t('notifications.empty') }}</p>
        }
      </mat-menu>
    </ng-container>
  `,
})
export class NotificationBell implements OnInit {
  protected inbox = inject(NotificationService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);
  private i18n = inject(I18nService);

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

  protected dotColor(n: AppNotification): string {
    return n.type === 'Absence' ? 'bg-danger-700' : n.type === 'Late' ? 'bg-warning-700' : 'bg-secondary-600';
  }

  protected open(notification: AppNotification): void {
    this.inbox.markRead(notification).subscribe();
    if (notification.link) this.router.navigateByUrl(notification.link);
  }

  protected markAll(): void {
    this.inbox.markAllRead().subscribe();
  }

  protected date(value: string): string {
    return formatOrgDate(value, 'Gregorian', { style: 'datetime', locale: this.i18n.lang() });
  }
}
