import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { I18nService } from '@/app/core/transloco/i18n.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  host: {
    // Ensure root component fills the entire viewport
    class: 'flex min-h-full w-full flex-auto flex-col',
  },
  template: `<router-outlet />`,
})
export class App {
  private i18nService = inject(I18nService);

  constructor() {
    this.i18nService.init();
  }
}
