import { Component, computed, inject, OnInit } from '@angular/core';
import { Router, RouterOutlet, ActivatedRoute, RouterLinkActive, RouterLink } from '@angular/router';
import { CourseBuilderStateService } from '../course-builder-state.service';
import { CourseStatus } from '../course-builder.models';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoDirective } from '@jsverse/transloco';
import { CommonModule } from '@angular/common';
import { OrgContextService } from '@/app/core/organizations/org-context.service';

@Component({
  selector: 'app-builder-layout',
  templateUrl: './builder-layout.component.html',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoDirective,
  ]
})
export default class BuilderLayoutComponent implements OnInit {
  private builderState = inject(CourseBuilderStateService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  protected orgContext = inject(OrgContextService);

  protected readonly steps = [
    { path: 'step-1', key: 'basics' },
    { path: 'step-2', key: 'pricing' },
    { path: 'step-3', key: 'media' },
    { path: 'step-4', key: 'curriculum' },
  ];

  state = this.builderState.state;
  isLoading = computed(() => this.route.snapshot.paramMap.has('id') ? !this.state().id : false);

  ngOnInit() {
    // Hydrate state from URL if editing
    // For 'new', id is 'new' in our route? Wait, the route says 'courses/new' points directly to step1. 
    // Actually our route setup points courses/new to step1 directly without layout. 
    // We should fix that: courses/new should also use the layout!
    
    // I will fix the routing so /courses/new uses this layout too.
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.builderState.getCourseDraft(id).subscribe({
        error: () => this.router.navigate(this.orgContext.path('dashboard'))
      });
    } else {
      // New course
      this.builderState.state.set({ status: CourseStatus.Draft });
    }
  }
}
