import { describe, expect, it } from 'vitest';
import { subjectColors, subjectMark } from './subject-look';

describe('subjectMark', () => {
  it('skips the Arabic article', () => {
    expect(subjectMark('العلوم')).toBe('ع');
    expect(subjectMark('  الرياضيات للصف الأول')).toBe('ر');
  });

  it('keeps short words and other languages whole', () => {
    expect(subjectMark('لغتي')).toBe('ل');
    expect(subjectMark('math')).toBe('M');
    expect(subjectMark('')).toBe('');
  });
});

describe('subjectColors', () => {
  it('gives up to three courses different colors', () => {
    expect(new Set(subjectColors(['a', 'b', 'c']).values()).size).toBe(3);
  });

  it('does not depend on list order', () => {
    const first = subjectColors(['a', 'b', 'c']);
    const second = subjectColors(['c', 'a', 'b']);
    expect(['a', 'b', 'c'].map(id => second.get(id))).toEqual(['a', 'b', 'c'].map(id => first.get(id)));
  });

  it('repeats colors after three courses', () => {
    expect(subjectColors(['a', 'b', 'c', 'd']).get('d')).toBe(subjectColors(['a', 'b', 'c', 'd']).get('a'));
  });
});
