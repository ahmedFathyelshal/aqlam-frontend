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
  selector: 'app-step2-commercials',
  templateUrl: './step2-commercials.component.html',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoDirective,
    FormField,
  ]
})
export default class Step2CommercialsComponent {
  private builderState = inject(CourseBuilderStateService);
  private router = inject(Router);
  protected orgContext = inject(OrgContextService);
  private transloco = inject(TranslocoService);

  isSubmitting = signal(false);
  /** Prices are in the organization's currency (by country until settings expose it). */
  protected currency = this.orgContext.activeOrg()?.countryCode === 'EG' ? 'EGP' : 'SAR';

  formModel = signal({
    pricingType: 'Paid' as any,
    price: '' as any,
    codeActivationOnly: false,
    accessExpiryPolicy: '' as any,
    accessDurationDays: '' as any,
  });

  commercialsForm = form(this.formModel, (f) => {
    required(f.pricingType, { message: this.transloco.translate('cb.s2.pricingRequired') });
    required(f.accessExpiryPolicy, { message: this.transloco.translate('cb.s2.accessRequired') });

    validate(f.price, (ctx) => {
      if (this.formModel().pricingType === 'Paid') {
        if (!ctx.value()) return { kind: 'required', message: this.transloco.translate('cb.s2.priceRequired') };
        if (Number(ctx.value()) < 10) return { kind: 'min', message: this.transloco.translate('cb.s2.priceMin') };
      }
      return null;
    });

    validate(f.accessDurationDays, (ctx) => {
      if (this.formModel().accessExpiryPolicy === 'Limited') {
        if (!ctx.value()) return { kind: 'required', message: this.transloco.translate('cb.s2.daysRequired') };
        if (Number(ctx.value()) < 1) return { kind: 'min', message: this.transloco.translate('cb.s2.daysMin') };
      }
      return null;
    });
  });

  pricingTypeField = this.commercialsForm.pricingType;
  priceField = this.commercialsForm.price;
  codeActivationField = this.commercialsForm.codeActivationOnly;
  expiryPolicyField = this.commercialsForm.accessExpiryPolicy;
  durationField = this.commercialsForm.accessDurationDays;

  constructor() {
    effect(() => {
      const state = this.builderState.state();
      if (state && state.id && !this.formModel().accessExpiryPolicy && state.accessExpiryPolicy) {
        this.formModel.set({
          pricingType: state.pricingType || 'Paid',
          price: state.price || '',
          codeActivationOnly: state.codeActivationOnly || false,
          accessExpiryPolicy: state.accessExpiryPolicy || '',
          accessDurationDays: state.accessDurationDays || '',
        });
      }
    }, { allowSignalWrites: true });
  }

  onNext(event: Event) {
    event.preventDefault();
    submit(this.commercialsForm, async () => {
      this.isSubmitting.set(true);

      const data = this.formModel();
      const currentDraft = this.builderState.state();

      this.builderState.updateCommercials(currentDraft.id!, {
        pricingType: data.pricingType,
        price: data.pricingType === 'Paid' ? Number(data.price) : undefined,
        codeActivationOnly: data.codeActivationOnly,
        accessExpiryPolicy: data.accessExpiryPolicy,
        accessDurationDays: data.accessExpiryPolicy === 'Limited' ? Number(data.accessDurationDays) : undefined,
      }).subscribe(() => {
        this.isSubmitting.set(false);
        this.router.navigate(this.orgContext.path('courses', currentDraft.id!, 'edit', 'step-3'));
      });
    });
  }

  goBack() {
    const currentDraft = this.builderState.state();
    if (currentDraft.id) {
      this.router.navigate(this.orgContext.path('courses', currentDraft.id!, 'edit', 'step-1'));
    } else {
      this.router.navigate(this.orgContext.path('dashboard'));
    }
  }
}
