import { Component, computed, input } from '@angular/core';

/**
 * The school's own logo, always in a white tile so it never sits on a coloured background or stretches.
 * Without a logo the tile shows the first letter of the name.
 */
@Component({
  selector: 'aq-org-mark',
  host: { class: 'inline-flex shrink-0' },
  template: `
    @if (logoUrl()) {
      <img [src]="logoUrl()" alt="" class="rounded-ui border border-line bg-white object-contain p-1" [style.width.px]="size()" [style.height.px]="size()" />
    } @else {
      <span aria-hidden="true" class="flex items-center justify-center rounded-ui border border-line bg-primary-50 font-display font-bold text-deep"
            [style.width.px]="size()" [style.height.px]="size()" [style.font-size.px]="size() * 0.6">{{ initial() }}</span>
    }
  `,
})
export class AqOrgMark {
  readonly name = input('');
  readonly logoUrl = input<string | null | undefined>(null);
  readonly size = input(40);

  /** Skips the article so "المدرسة النموذجية" shows م, not ا. */
  protected initial = computed(() => {
    const word = this.name().trim().split(/\s+/)[0] ?? '';
    return (word.startsWith('ال') && word.length > 2 ? word[2] : word[0]) ?? '';
  });
}
