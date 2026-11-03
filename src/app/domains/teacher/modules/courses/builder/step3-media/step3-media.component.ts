import { Component, inject, signal, effect } from '@angular/core';
import { CourseBuilderStateService } from '../course-builder-state.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { form, FormField, required, submit, validate } from '@angular/forms/signals';
import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-step3-media',
  templateUrl: './step3-media.component.html',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoDirective,
    FormField,
  ]
})
export default class Step3MediaComponent {
  private builderState = inject(CourseBuilderStateService);
  private router = inject(Router);
  protected orgContext = inject(OrgContextService);
  private transloco = inject(TranslocoService);

  isSubmitting = signal(false);
  previewUrl = signal<string | null>(null);
  thumbnailError = signal<string | null>(null);

  formModel = signal({
    subtitle: '',
    promoVideoUrl: '',
  });

  mediaForm = form(this.formModel, (f) => {
    required(f.subtitle, { message: this.transloco.translate('cb.s3.subtitleRequired') });
    validate(f.subtitle, (ctx) => {
      if (ctx.value() && ctx.value().length > 250) {
        return { kind: 'maxlength', message: this.transloco.translate('cb.s3.subtitleMax') };
      }
      return null;
    });

    validate(f.promoVideoUrl, (ctx) => {
      const val = ctx.value();
      if (val) {
        const regex = /^(https?\:\/\/)?(www\.youtube\.com|youtu\.?be|vimeo\.com|video\.bunny\.net)\/.+$/;
        if (!regex.test(val)) {
          return { kind: 'pattern', message: this.transloco.translate('cb.s3.videoInvalid') };
        }
      }
      return null;
    });
  });

  subtitleField = this.mediaForm.subtitle;
  promoVideoField = this.mediaForm.promoVideoUrl;

  constructor() {
    effect(() => {
      const state = this.builderState.state();
      if (state && state.id && !this.formModel().subtitle && state.subtitle) {
        this.formModel.set({
          subtitle: state.subtitle || '',
          promoVideoUrl: state.promoVideoUrl || '',
        });
        if (state.thumbnailUrl) {
          this.previewUrl.set(state.thumbnailUrl);
        }
      }
    }, { allowSignalWrites: true });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        this.thumbnailError.set(this.transloco.translate('cb.s3.tooBig'));
        return;
      }
      this.thumbnailError.set(null);
      // Mock File Upload by creating object URL
      this.previewUrl.set(URL.createObjectURL(file));
    }
  }

  onNext(event: Event) {
    event.preventDefault();
    submit(this.mediaForm, async () => {
      if (!this.previewUrl()) {
        this.thumbnailError.set(this.transloco.translate('cb.s3.thumbnailRequired'));
        return;
      }

      this.isSubmitting.set(true);
      const data = this.formModel();
      const currentDraft = this.builderState.state();

      this.builderState.updateMedia(currentDraft.id!, {
        subtitle: data.subtitle,
        promoVideoUrl: data.promoVideoUrl,
        thumbnailUrl: this.previewUrl()!,
      }).subscribe(() => {
        this.isSubmitting.set(false);
        this.router.navigate(this.orgContext.path('courses', currentDraft.id!, 'edit', 'step-4'));
      });
    });
  }

  goBack() {
    const currentDraft = this.builderState.state();
    if (currentDraft.id) {
      this.router.navigate(this.orgContext.path('courses', currentDraft.id!, 'edit', 'step-2'));
    } else {
      this.router.navigate(this.orgContext.path('dashboard'));
    }
  }
}
