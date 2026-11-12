import { inject, Injectable, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { forkJoin } from 'rxjs';

import { LookupDto, LookupsService } from '../services/lookups.service';

/** Subject and grade names for public cards and filters, loaded once and shown in the reader's language. */
@Injectable({ providedIn: 'root' })
export class LookupNames {
  private lookups = inject(LookupsService);
  private transloco = inject(TranslocoService);

  readonly subjects = signal<LookupDto[]>([]);
  readonly grades = signal<LookupDto[]>([]);
  private loaded = false;

  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    forkJoin({ subjects: this.lookups.getSubjects(), grades: this.lookups.getEducationGrades() }).subscribe({
      next: ({ subjects, grades }) => {
        this.subjects.set(subjects);
        this.grades.set(grades);
      },
      error: () => (this.loaded = false),
    });
  }

  subject(id: number | null | undefined): string {
    return this.name(this.subjects(), id);
  }

  grade(id: number | null | undefined): string {
    return this.name(this.grades(), id);
  }

  name(list: LookupDto[], id: number | null | undefined): string {
    const item = id == null ? undefined : list.find(x => x.id === id);
    if (!item) return '';
    return this.transloco.getActiveLang() === 'ar' ? item.nameAr : item.nameEn;
  }
}
