import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type ConfirmOptions = {
  title: string;
  body?: string;
  confirmText: string;
  cancelText: string;
  /** "danger" for deletions: solid red confirm, and Cancel gets the first focus. */
  tone?: 'primary' | 'danger';
};

@Component({
  selector: 'aq-confirm-dialog',
  host: { class: 'block w-[min(28rem,calc(100vw-2rem))] rounded-card bg-white p-6 shadow-[0_24px_60px_rgba(11,59,46,0.18)]' },
  template: `
    <h2 id="aq-confirm-title" class="text-lg font-bold text-ink">{{ data.title }}</h2>
    @if (data.body) { <p class="mt-2 text-muted">{{ data.body }}</p> }
    <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button type="button" class="btn btn-outline" [attr.cdkFocusInitial]="isDanger ? '' : null" (click)="ref.close(false)">{{ data.cancelText }}</button>
      <button type="button" class="btn" [class]="isDanger ? 'btn-danger-solid' : 'btn-primary'" [attr.cdkFocusInitial]="isDanger ? null : ''" (click)="ref.close(true)">{{ data.confirmText }}</button>
    </div>
  `,
})
class ConfirmDialog {
  protected data = inject<ConfirmOptions>(DIALOG_DATA);
  protected ref = inject<DialogRef<boolean>>(DialogRef);
  protected isDanger = this.data.tone === 'danger';
}

/** Replaces the browser's confirm(): styled, translated, RTL-aware; Esc and the backdrop cancel. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private dialog = inject(Dialog);

  async confirm(options: ConfirmOptions): Promise<boolean> {
    const ref = this.dialog.open<boolean>(ConfirmDialog, {
      data: options,
      role: 'alertdialog',
      ariaLabelledBy: 'aq-confirm-title',
      backdropClass: 'aq-dialog-backdrop',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });
    return (await firstValueFrom(ref.closed)) === true;
  }
}
