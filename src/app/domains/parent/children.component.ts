import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { Child, FamilyService } from '@/app/core/school/family.service';
import { errorMessages } from '@/app/core/utils/api-error.utils';

/** A parent's children, and the form to link another child with the code from the school. */
@Component({
  selector: 'app-parent-children',
  imports: [MatButtonModule, MatIconModule, RouterLink],
  template: `
    <div class="space-y-6">
      @for (child of children(); track child.userId) {
        <section class="rounded-2xl border bg-white p-5 dark:bg-neutral-800">
          <h2 class="text-lg font-semibold">{{ child.fullName }}</h2>
          <div class="mt-3 flex flex-wrap gap-2">
            @for (org of child.organizations; track org.organizationId) {
              <a matButton="outlined" [routerLink]="['/parent', org.slug, 'children', child.userId]">{{ org.name }}</a>
            } @empty {
              <p class="text-sm text-neutral-500">Not enrolled in a school or center at the moment.</p>
            }
          </div>
        </section>
      } @empty {
        <p class="text-neutral-500">No children linked yet. Enter the code you received from the school.</p>
      }

      <section class="space-y-3 rounded-2xl border bg-white p-5 dark:bg-neutral-800">
        <h2 class="font-semibold">Link a child</h2>
        <p class="text-sm text-neutral-500">The school or center gives each family a one-time code.</p>
        <form class="flex flex-wrap gap-2" (submit)="$event.preventDefault(); link()">
          <input class="min-w-40 flex-1 rounded-lg border px-3 py-2 font-mono tracking-widest uppercase dark:bg-neutral-900" dir="ltr" maxlength="32"
                 placeholder="ABCD2345" autocomplete="off" [value]="code()" (input)="code.set($any($event.target).value)" />
          <button matButton="filled" type="submit" [disabled]="linking() || code().trim().length < 6">Link</button>
        </form>
        @if (error()) { <p class="text-sm text-red-600">{{ error() }}</p> }
        @if (linked()) { <p class="text-sm text-green-700 dark:text-green-400">{{ linked() }} is now linked to your account.</p> }
      </section>
    </div>
  `,
})
export default class ParentChildrenComponent {
  private family = inject(FamilyService);
  private orgContext = inject(OrgContextService);

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
        this.error.set(errorMessages(err, 'This code could not be used.').join(' '));
      },
    });
  }

  private load(): void {
    this.family.children().subscribe(c => this.children.set(c));
  }
}
