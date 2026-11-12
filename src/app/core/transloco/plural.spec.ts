import { describe, expect, it } from 'vitest';

import { translations } from './i18n';
import { pluralKey } from './plural';

const COUNTED = [
  'market.card.lessons', 'market.card.courses', 'market.card.previews', 'market.coursesCount', 'market.teachersCount',
  'market.otherTabHits', 'market.course.chapters', 'market.course.previewCount', 'earnings.excluded', 'codesAdmin.createN',
];
const FORMS = ['zero', 'one', 'two', 'few', 'many', 'other'];
const at = (root: unknown, key: string) => key.split('.').reduce<unknown>((node, k) => (node as Record<string, unknown>)?.[k], root);

describe('pluralKey', () => {
  it('uses the Arabic forms: one, two, 3–10, 11–99', () => {
    expect(pluralKey('k', 0, 'ar')).toBe('k.zero');
    expect(pluralKey('k', 1, 'ar')).toBe('k.one');
    expect(pluralKey('k', 2, 'ar')).toBe('k.two');
    expect(pluralKey('k', 6, 'ar')).toBe('k.few');
    expect(pluralKey('k', 12, 'ar')).toBe('k.many');
    expect(pluralKey('k', 100, 'ar')).toBe('k.other');
  });

  it('uses one/other in English', () => {
    expect(pluralKey('k', 1, 'en')).toBe('k.one');
    expect(pluralKey('k', 2, 'en')).toBe('k.other');
  });

  it('has every form of every counted text in both languages', () => {
    const missing = COUNTED.flatMap(key =>
      (['ar', 'en'] as const).flatMap(lang => FORMS.filter(form => typeof at(translations[lang], `${key}.${form}`) !== 'string').map(form => `${lang}:${key}.${form}`))
    );
    expect(missing).toEqual([]);
    // "6 درسًا" was wrong; 3–10 take the plural.
    expect(at(translations.ar, 'market.card.lessons.few')).toBe('{{count}} دروس');
  });
});
