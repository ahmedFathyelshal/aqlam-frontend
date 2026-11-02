import { Component, inject, signal, effect, untracked, computed } from '@angular/core';
import { CourseBuilderStateService } from '../course-builder-state.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { NgSelectModule } from '@ng-select/ng-select';

import { LookupsService, LookupDto } from '../../../../../../core/services/lookups.service';

@Component({
  selector: 'app-step1-identity',
  templateUrl: './step1-identity.component.html',
  styleUrls: ['./step1-identity.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    FormField,
    NgSelectModule,
  ]
})
export default class Step1IdentityComponent {
  private builderState = inject(CourseBuilderStateService);
  private router = inject(Router);
  private lookupsService = inject(LookupsService);

  isSubmitting = signal(false);

  stages = signal<LookupDto[]>([]);
  grades = signal<LookupDto[]>([]);
  subjects = signal<LookupDto[]>([]);

  // Form State Model
  formModel = signal({
    title: '',
    stageId: null as number | null,
    gradeId: null as number | null,
    subjectId: null as number | null,
  });

  // Signal-based form definitions
  identityForm = form(this.formModel, (f) => {
    required(f.title, { message: 'Title is required' });
    required(f.stageId, { message: 'Educational stage is required' });
    required(f.gradeId, { message: 'Grade level is required' });
    required(f.subjectId, { message: 'Subject is required' });
  });

  // Expose fields directly to template
  titleField = this.identityForm.title;
  stageField = this.identityForm.stageId;
  gradeField = this.identityForm.gradeId;
  subjectField = this.identityForm.subjectId;

  constructor() {
    // Fetch initial lookups safely
    this.lookupsService.getEducationStages().subscribe({
      next: data => this.stages.set(data || []),
      error: () => this.stages.set([])
    });
    
    this.lookupsService.getSubjects().subscribe({
      next: data => this.subjects.set(data || []),
      error: () => this.subjects.set([])
    });

    // Cascading Grades based on Stage selection
    const stageIdSignal = computed(() => this.formModel().stageId);
    
    effect(() => {
      const stageId = stageIdSignal();
      untracked(() => {
        if (stageId) {
          this.lookupsService.getEducationGrades(stageId).subscribe({
            next: data => {
              const newGrades = data || [];
              this.grades.set(newGrades);
              
              // If the currently selected grade doesn't belong to the new stage, clear it.
              const currentGradeId = this.formModel().gradeId;
              if (currentGradeId !== null && !newGrades.some(g => g.id === currentGradeId)) {
                this.formModel.update(m => ({ ...m, gradeId: null }));
              }
            },
            error: () => this.grades.set([])
          });
        } else {
          this.grades.set([]);
          if (this.formModel().gradeId !== null) {
            this.formModel.update(m => ({ ...m, gradeId: null }));
          }
        }
      });
    }, { allowSignalWrites: true });

    // Hydrate form if state already exists
    effect(() => {
      const state = this.builderState.state();
      if (state && state.title) {
        untracked(() => {
          if (!this.formModel().title) {
            this.formModel.set({
              title: state.title || '',
              stageId: state.stageId || null,
              gradeId: state.gradeId || null,
              subjectId: state.subjectId || null,
            });
          }
        });
      }
    }, { allowSignalWrites: true });
  }

  onNext(event: Event) {
    event.preventDefault();
    submit(this.identityForm, async () => {
      this.isSubmitting.set(true);

      const title = this.identityForm.title().value();
      const stageId = Number(this.identityForm.stageId().value());
      const gradeId = Number(this.identityForm.gradeId().value());
      const subjectId = Number(this.identityForm.subjectId().value());

      const currentDraft = this.builderState.state();

      if (currentDraft.id) {
        // Editing existing
        this.builderState.updateIdentity(currentDraft.id, {
          title: title,
          stageId: stageId,
          gradeId: gradeId,
          subjectId: subjectId,
        }).subscribe({
          next: () => {
            this.isSubmitting.set(false);
            this.router.navigate(['/teacher/courses', currentDraft.id, 'edit', 'step-2']);
          },
          error: (err) => {
            console.error('API Error:', err);
            this.isSubmitting.set(false);
            alert('Failed to connect to the backend. Is the API running?');
          }
        });
      } else {
        // New Course
        this.builderState.initializeCourse({
          title: title,
          stageId: stageId,
          gradeId: gradeId,
          subjectId: subjectId,
        }).subscribe({
          next: (res) => {
            this.isSubmitting.set(false);
            this.router.navigate(['/teacher/courses', res.id, 'edit', 'step-2']);
          },
          error: (err) => {
            console.error('API Error:', err);
            this.isSubmitting.set(false);
            alert('Failed to connect to the backend. Is the API running?');
          }
        });
      }
    });
  }

  goBack() {
    this.router.navigate(['/teacher/dashboard']);
  }
}
