import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

/** A calm "not available" page. It never says why (hidden, deleted or a school's private course). */
@Component({
  selector: 'aq-not-found-block',
  imports: [RouterLink, MatIconModule, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <div class="mx-auto max-w-[640px] px-4 py-20">
        <div class="empty">
          <mat-icon svgIcon="compass" class="empty-icon" />
          <h1 class="empty-title">{{ t('market.notFound') }}</h1>
          <p class="text-muted">{{ t('market.notFoundHint') }}</p>
          <a class="btn btn-primary mt-4" routerLink="/search">{{ t('market.notFoundAction') }}</a>
        </div>
      </div>
    </ng-container>
  `,
})
export class NotFoundBlock {}
