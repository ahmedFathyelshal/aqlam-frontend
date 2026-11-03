import { auth } from './auth';
import { common } from './common';
import { learn } from './learn';
import { legacy } from './legacy';
import { portal } from './portal';
import { staff } from './staff';

type Lang = 'ar' | 'en';
type Section = Record<Lang, Record<string, unknown>>;

/** Every feature's texts merged per language (feature keys are top-level, so they never collide). */
const sections: Section[] = [legacy, common, auth, staff, portal, learn];

export const translations = {
  ar: Object.assign({}, ...sections.map(s => s.ar)),
  en: Object.assign({}, ...sections.map(s => s.en)),
};
