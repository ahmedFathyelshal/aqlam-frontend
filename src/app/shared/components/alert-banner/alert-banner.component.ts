import { Component, Input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';

export type AlertType = 'error' | 'warning' | 'success' | 'info';

@Component({
  selector: 'app-alert-banner',
  imports: [CommonModule, MatIconModule],
  template: `
    @if (messages() && messages().length > 0) {
      <div [class]="getContainerClasses()">
        <div class="flex items-start gap-x-3">
          <mat-icon [class]="getIconClasses()" [svgIcon]="getIconName()"></mat-icon>
          <div class="flex flex-col">
            <strong class="mb-1" *ngIf="title()">{{ title() }}</strong>
            <ul class="m-0 pl-0 list-none" [class.mt-1]="title()">
              @for (msg of messages(); track msg) {
                <li>{{ msg }}</li>
              }
            </ul>
          </div>
        </div>
      </div>
    }
  `
})
export class AlertBannerComponent {
  @Input('message') set setMessage(val: string | string[] | null) {
    if (!val) {
      this.messages.set([]);
    } else if (Array.isArray(val)) {
      this.messages.set(val);
    } else {
      this.messages.set([val]);
    }
  }
  
  @Input('title') set setTitle(val: string | null) {
    this.title.set(val);
  }

  @Input('type') set setType(val: AlertType) {
    this.type.set(val);
  }

  messages = signal<string[]>([]);
  title = signal<string | null>(null);
  type = signal<AlertType>('error');

  getContainerClasses(): string {
    const base = 'mt-8 rounded-lg p-4 border';
    switch (this.type()) {
      case 'error':
        return `${base} bg-red-100 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-200 dark:border-red-800`;
      case 'warning':
        return `${base} bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/50 dark:text-orange-200 dark:border-orange-800`;
      case 'success':
        return `${base} bg-green-100 text-green-700 border-green-200 dark:bg-green-900/50 dark:text-green-200 dark:border-green-800`;
      case 'info':
        return `${base} bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-800`;
    }
  }

  getIconClasses(): string {
    switch (this.type()) {
      case 'error': return 'text-red-600 dark:text-red-400';
      case 'warning': return 'text-orange-600 dark:text-orange-400';
      case 'success': return 'text-green-600 dark:text-green-400';
      case 'info': return 'text-blue-600 dark:text-blue-400';
    }
  }

  getIconName(): string {
    switch (this.type()) {
      case 'error': return 'heroicons_outline:exclamation-circle';
      case 'warning': return 'heroicons_outline:exclamation-triangle';
      case 'success': return 'heroicons_outline:check-circle';
      case 'info': return 'heroicons_outline:information-circle';
    }
  }
}
