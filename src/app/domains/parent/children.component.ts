import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { Child, FamilyService } from '@/app/core/school/family.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';

/** A parent's children, and the form to link another child with the code from the school. */
@Component({
  selector: 'app-parent-children',
  imports: [MatIconModule, RouterLink, TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <div class="page-narrow">
        <h1 class="page-title mb-5">{{ t('parent.title') }}</h1>

        <div class="flex flex-col gap-3">
          @for (child of children(); track child.userId) {
            <section class="card card-body">
              <div class="flex items-center gap-3">
                <span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xl font-extrabold text-primary-700">{{ child.fullName.charAt(0) }}</span>
                <h2 class="text-lg font-extrabold">{{ child.fullName }}</h2>
              </div>
              <div class="mt-3 flex flex-col gap-2">
                @for (org of child.organizations; track org.organizationId) {
                  <a class="flex min-h-12 items-center justify-between gap-2 rounded-ui border border-line px-4 text-ink no-underline hover:bg-neutral-50" [routerLink]="['/parent', org.slug, 'children', child.userId]">
                    <span class="font-bold">{{ org.name }}</span>
                    <mat-icon svgIcon="chevron-left" class="icon-size-5 text-muted ltr:rotate-180" />
                  </a>
                } @empty {
                  <p class="text-muted">{{ t('parent.notEnrolled') }}</p>
                }
              </div>
            </section>
          } @empty {
            <div class="empty"><mat-icon svgIcon="users-round" class="icon-size-8" />{{ t('parent.noChildren') }}</div>
          }
        </div>

        <section class="card card-body mt-6">
          <h2 class="section-title">{{ t('parent.linkTitle') }}</h2>
          <p class="field-hint mt-1">{{ t('parent.linkHint') }}</p>
          <form class="mt-3 flex flex-wrap gap-2" (submit)="$event.preventDefault(); link()">
            <input class="input min-w-40 flex-1 font-mono tracking-[0.25em] uppercase" dir="ltr" maxlength="32" placeholder="ABCD2345" autocomplete="off"
                   [attr.aria-label]="t('parent.code')" [value]="code()" (input)="code.set($any($event.target).value)" />
            <button type="submit" class="btn btn-primary" [disabled]="linking() || code().trim().length < 6">{{ t('parent.link') }}</button>
          </form>
          @if (error()) { <p class="field-error mt-2" role="alert">{{ error() }}</p> }
          @if (linked()) { <div class="alert alert-success mt-3" role="status">{{ t('parent.linked', { name: linked() }) }}</div> }
        </section>
      </div>
    </ng-container>
  `,
})
export default class ParentChildrenComponent {
  private family = inject(FamilyService);
  private orgContext = inject(OrgContextService);
  private transloco = inject(TranslocoService);

  protected children = signal<Child[]>([]);
  protected code = signal('');
  protected linking = signal(false);
  protected error = signal<string | null>(null);
  protected linked = signal<string | null>(null);

  constructor() {
    this.load();
  }

  protected link(): void {
    this.linking.set(true);
    this.error.set(null);
    this.linked.set(null);
    this.family.linkChild(this.code().trim()).subscribe({
      next: child => {
        this.linking.set(false);
        this.code.set('');
        this.linked.set(child.fullName);
        this.load();
        this.orgContext.load().subscribe(); // the new Parent membership
      },
      error: (err: unknown) => {
        this.linking.set(false);
        this.error.set(errorMessages(err, this.transloco.translate('parent.invalid')).join(' '));
      },
    });
  }

  private load(): void {
    this.family.children().subscribe(c => this.children.set(c));
  }
}
