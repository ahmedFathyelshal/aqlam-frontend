import { Component, computed, input } from '@angular/core';

/**
 * The Aqlam mark: ق in a green circle with a blue ink dot (the dot is dropped below 40px),
 * optionally followed by the wordmark أقلام. `inverse` is for green backgrounds.
 */
@Component({
  selector: 'aq-logo',
  host: { class: 'inline-flex items-center gap-2.5' },
  template: `
    <span
      class="relative inline-flex shrink-0 items-center justify-center rounded-full"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [style.background]="inverse() ? '#FFFFFF' : '#146C43'"
      aria-hidden="true"
    >
      <span
        class="font-logo leading-none font-bold"
        [style.font-size.px]="size() * 0.57"
        [style.margin-top.px]="-size() * 0.1"
        [style.color]="inverse() ? '#146C43' : '#FFFFFF'"
        >ق</span
      >
      @if (size() >= 40) {
        <span
          class="absolute start-1/2 -translate-x-1/2 rounded-full rtl:translate-x-1/2"
          [style.bottom.px]="size() * 0.12"
          [style.width.px]="size() * 0.13"
          [style.height.px]="size() * 0.13"
          [style.background]="inverse() ? '#1D5C96' : '#8DB8E6'"
        ></span>
      }
    </span>
    @if (wordmark()) {
      <span class="flex flex-col leading-tight">
        <span class="font-extrabold" [style.font-size.px]="wordSize()" [class.text-primary-600]="!inverse()" [class.text-white]="inverse()">أقلام</span>
        @if (subtitle()) {
          <span class="text-sm" [class.text-muted]="!inverse()" [class.text-primary-100]="inverse()">{{ subtitle() }}</span>
        }
      </span>
    }
    <span class="sr-only">أقلام Aqlam</span>
  `,
})
export class AqLogo {
  readonly size = input(40);
  readonly wordmark = input(true);
  readonly inverse = input(false);
  readonly subtitle = input<string | null>(null);

  protected wordSize = computed(() => Math.round(this.size() * 0.5));
}
