const SUBJECT_COLORS = ['var(--color-subject-blue)', 'var(--color-subject-green)', 'var(--color-subject-earth)'];

/**
 * Colors for one student's courses: neighbours differ, and each course keeps its color whatever order
 * the list comes in (it is sorted by recent use), because colors go by id rather than position on screen.
 */
export function subjectColors(courseIds: string[]): Map<string, string> {
  const sorted = [...new Set(courseIds)].sort();
  return new Map(sorted.map((id, i) => [id, SUBJECT_COLORS[i % SUBJECT_COLORS.length]]));
}

/** The letter on a subject tile: the first of the title, skipping the Arabic article (العلوم gives ع). */
export function subjectMark(title: string): string {
  const name = title.trim();
  const word = name.startsWith('ال') && name.length > 3 ? name.slice(2) : name;
  return Array.from(word)[0]?.toLocaleUpperCase() ?? '';
}
