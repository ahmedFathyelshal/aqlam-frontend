import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoDirective } from '@jsverse/transloco';
import { filter } from 'rxjs';

import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { AqInkBar } from '@/app/shared/ui/ink-bar';
import { CourseBuilderStateService } from '../course-builder-state.service';
import { CourseStatus } from '../course-builder.models';

/** Course builder frame: the step indicator (ink bar between numbered steps) and the current step. */
@Component({
  selector: 'app-builder-layout',
  templateUrl: './builder-layout.component.html',
  imports: [RouterOutlet, RouterLink, MatIconModule, TranslocoDirective, AqInkBar],
})
export default class BuilderLayoutComponent implements OnInit {
  private builderState = inject(CourseBuilderStateService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  protected orgContext = inject(OrgContextService);

  protected readonly steps = [
    { path: 'step-1', key: 'basics' },
    { path: 'step-2', key: 'pricing' },
    { path: 'step-3', key: 'media' },
    { path: 'step-4', key: 'curriculum' },
  ];

  protected state = this.builderState.state;
  protected isLoading = computed(() => (this.route.snapshot.paramMap.has('id') ? !this.state().id : false));

  private url = signal(this.router.url);
  /** Index of the step in the address (step-1 … step-4). */
  protected current = computed(() => {
    const index = this.steps.findIndex(s => this.url().includes(`/${s.path}`));
    return index < 0 ? 0 : index;
  });
  protected progress = computed(() => (this.current() * 100) / (this.steps.length - 1));

  ngOnInit(): void {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.url.set(this.router.url));

    // Editing loads the draft; /courses/new starts empty (it shows step 1 only until the draft exists).
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.builderState.getCourseDraft(id).subscribe({ error: () => this.router.navigate(this.orgContext.path('dashboard')) });
    } else {
      this.builderState.state.set({ status: CourseStatus.Draft });
    }
  }
}
