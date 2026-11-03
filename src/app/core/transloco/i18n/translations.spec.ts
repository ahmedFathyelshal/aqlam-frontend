import { describe, expect, it } from 'vitest';
import { translations } from './index';

/** Dotted paths of every leaf text (arrays count as one entry). */
function keys(node: unknown, prefix = ''): string[] {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return [prefix];
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) => keys(value, prefix ? `${prefix}.${key}` : key));
}

describe('translations', () => {
  it('has the same keys in Arabic and English', () => {
    const ar = keys(translations.ar).sort();
    const en = keys(translations.en).sort();
    expect(ar.filter(k => !en.includes(k))).toEqual([]);
    expect(en.filter(k => !ar.includes(k))).toEqual([]);
  });

  it('keeps every interpolation placeholder in both languages', () => {
    const placeholders = (text: unknown) => (typeof text === 'string' ? (text.match(/{{\s*\w+\s*}}/g) ?? []).map(p => p.replace(/\s/g, '')).sort() : []);
    const value = (root: unknown, path: string) => path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], root);
    const mismatched = keys(translations.ar).filter(
      k => JSON.stringify(placeholders(value(translations.ar, k))) !== JSON.stringify(placeholders(value(translations.en, k)))
    );
    expect(mismatched).toEqual([]);
  });
});
