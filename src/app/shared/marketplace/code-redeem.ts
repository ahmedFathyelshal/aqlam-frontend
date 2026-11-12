import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoDirective } from '@jsverse/transloco';

import { formatCode, MarketplaceService, Redeemed } from '@/app/core/marketplace/marketplace.service';
import { ApiValidationError } from '@/app/core/utils/api-error.utils';

/** Which message to show for a refused code; the API's English messages are mapped, never shown raw. */
export function codeErrorKey(error: unknown): string {
  // 400s arrive already unwrapped by the error interceptor.
  if (error instanceof ApiValidationError) return error.errors.join(' ').toLowerCase().includes('for this course') ? 'wrongCourse' : 'invalid';
  if (!(error instanceof HttpErrorResponse)) return 'network';
  if (error.status === 429) return 'tooMany';
  if (error.status === 0 || error.status >= 500) return 'network';
  const text = JSON.stringify(error.error ?? '').toLowerCase();
  if (text.includes('for this course')) return 'wrongCourse';
  if (text.includes('already enrolled') || text.includes('already used this code')) return 'already';
  if (text.includes('already been used')) return 'used';
  if (text.includes('cancelled')) return 'cancelled';
  if (text.includes('expired')) return 'expired';
  if (text.includes('not open')) return 'closed';
  return 'invalid';
}

/**
 * The activation-code field: formats XXXX-XXXX-XXXX while typing (paste, lower case, spaces, Arabic-Indic digits all
 * work), keeps the value on errors, and tells disputes to go to the center that sold the card.
 */
@Component({
  selector: 'aq-code-redeem',
  imports: [MatIconModule, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <form class="flex flex-col gap-2" (submit)="$event.preventDefault(); submit()">
        <label class="field-label" [for]="inputId">{{ t('codes.label') }}</label>
        <div class="flex gap-2">
          <input [id]="inputId" dir="ltr" class="input min-h-12 grow font-mono text-lg tracking-[0.12em] uppercase" autocomplete="off" autocapitalize="characters"
                 spellcheck="false" placeholder="XXXX-XXXX-XXXX" maxlength="16" [value]="code()" (input)="onInput($event)"
                 [attr.aria-invalid]="!!error()" [attr.aria-describedby]="inputId + '-hint'" />
          <button type="submit" class="btn btn-primary min-h-12 min-w-24" [disabled]="busy() || !complete() || error() === 'tooMany'">
            {{ busy() ? t('codes.checking') : t('codes.activate') }}
          </button>
        </div>
        @if (error()) {
          <p class="field-error" role="alert">{{ t('codes.' + error()) }}</p>
        } @else {
          <p class="field-hint" [id]="inputId + '-hint'">{{ t('codes.hint') }}</p>
        }
      </form>
    </ng-container>
  `,
})
export class AqCodeRedeem {
  private static next = 0;
  private api = inject(MarketplaceService);
  protected inputId = `code-${AqCodeRedeem.next++}`;

  readonly courseId = input<string | null>(null);
  readonly redeemed = output<Redeemed>();

  protected code = signal('');
  protected busy = signal(false);
  protected error = signal<string | null>(null);
  protected complete = computed(() => this.code().replace(/-/g, '').length === 12);

  protected onInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    const formatted = formatCode(el.value);
    el.value = formatted;
    this.code.set(formatted);
    if (this.error() !== 'tooMany') this.error.set(null);
  }

  protected submit(): void {
    if (!this.complete() || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.redeem(this.code(), this.courseId()).subscribe({
      next: result => {
        this.busy.set(false);
        this.redeemed.emit(result);
      },
      error: err => {
        this.busy.set(false);
        this.error.set(codeErrorKey(err));
      },
    });
  }
}
