import { Component, computed, input } from '@angular/core';

import { AqInkBar } from './ink-bar';

/**
 * The ink bar with a tick at a reference value (the school's limit or its average). Decorative:
 * the value is always printed as text next to it, so colour never carries the meaning alone.
 */
@Component({
  selector: 'aq-bullet-bar',
  imports: [AqInkBar],
  host: { class: 'relative block' },
  template: `
    <aq-ink-bar [percent]="percent() ?? 0" [color]="color()" [height]="height()" />
    @if (reference() !== null) {
      <span aria-hidden="true" class="absolute -top-[3px] h-[calc(100%+6px)] w-0.5 rounded bg-ink/70" [style.inset-inline-start.%]="reference()"></span>
    }
  `,
})
export class AqBulletBar {
  readonly percent = input.required<number | null>();
  readonly reference = input<number | null>(null);
  /** Points under the reference that still count as "watch" rather than "act". */
  readonly watchBand = input(5);
  readonly height = input(8);

  protected color = computed(() => {
    const value = this.percent();
    const ref = this.reference();
    if (value === null) return 'var(--color-line)';
    if (ref === null || value >= ref) return 'var(--color-primary-600)';
    return value >= ref - this.watchBand() ? 'var(--color-warning-500)' : 'var(--color-danger-600)';
  });
}
