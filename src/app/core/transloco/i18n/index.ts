import { academics } from './academics';
import { assess } from './assess';
import { auth } from './auth';
import { builder } from './builder';
import { common } from './common';
import { learn } from './learn';
import { portal } from './portal';
import { staff } from './staff';
import { workspace } from './workspace';

type Lang = 'ar' | 'en';
type Section = Record<Lang, Record<string, unknown>>;

/** Every feature's texts merged per language (feature keys are top-level, so they never collide). */
const sections: Section[] = [common, auth, staff, portal, learn, assess, builder, workspace, academics];

export const translations = {
  ar: Object.assign({}, ...sections.map(s => s.ar)),
  en: Object.assign({}, ...sections.map(s => s.en)),
};
