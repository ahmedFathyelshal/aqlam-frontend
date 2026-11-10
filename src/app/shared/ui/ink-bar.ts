import { Component, computed, input } from '@angular/core';

/** Progress drawn as a pen stroke, the signature of the مداد style. Decorative: state the value in text next to it. */
@Component({
  selector: 'aq-ink-bar',
  host: { class: 'block' },
  template: `
    <svg aria-hidden="true" viewBox="0 0 200 12" preserveAspectRatio="none" class="block w-full ltr:-scale-x-100" [style.height.px]="height()">
      <path d="M198 6 C150 3 90 9 2 6" fill="none" stroke-width="4" stroke-linecap="round" [style.stroke]="track()" [style.opacity]="trackOpacity()" />
      @if (clamped() > 0) {
        <path d="M198 6 C150 3 90 9 2 6" fill="none" stroke-width="4" stroke-linecap="round" pathLength="100" [attr.stroke-dasharray]="clamped() + ' 100'" [style.stroke]="color()" />
      }
    </svg>
  `,
})
export class AqInkBar {
  readonly percent = input.required<number>();
  readonly color = input('var(--color-secondary-600)');
  readonly track = input('var(--color-line)');
  readonly trackOpacity = input(1);
  readonly height = input(10);

  protected clamped = computed(() => Math.min(100, Math.max(0, this.percent())));
}
