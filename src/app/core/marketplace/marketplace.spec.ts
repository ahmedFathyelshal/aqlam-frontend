import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { ctaState } from '@/app/domains/public/course.page';
import { shortName } from '@/app/domains/teacher/modules/market/earnings.component';
import { codeErrorKey } from '@/app/shared/marketplace/code-redeem';
import { durationText, initials, subjectColor } from '@/app/shared/marketplace/market-ui';
import { CoursePage, formatCode, formatPrice } from './marketplace.service';
import { ApiValidationError } from '../utils/api-error.utils';

const page = (course: Partial<CoursePage['course']> = {}, viewer: Partial<CoursePage['viewer']> = {}, onlinePaymentAvailable = true): CoursePage => ({
  course: {
    slug: 's', title: 'T', subtitle: null, thumbnailUrl: null, organizationName: 'O', organizationType: 'Personal', teacherName: 'N', teacherSlug: null,
    countryCode: 'SA', currency: 'SAR', isFree: false, price: 150, codeActivationOnly: false, isComingSoon: false, lessonCount: 1, totalMinutes: 10,
    freePreviewCount: 0, curriculumId: null, gradeId: null, subjectId: null, ...course,
  },
  courseId: 'c', organizationSlug: 'o', promoVideoUrl: null, syllabusRequirements: null, accessExpiryPolicy: 'Unlimited', accessDurationDays: null,
  chapters: [], teacher: null, onlinePaymentAvailable,
  viewer: { signedIn: false, enrolled: false, isStaff: false, hasPendingPayment: false, ...viewer },
});

describe('course call to action', () => {
  it('follows the agreed order: staff, enrolled, soon, pending, code, free, paid', () => {
    expect(ctaState(page({ isComingSoon: true }, { isStaff: true, enrolled: true }))).toBe('staff');
    expect(ctaState(page({ isComingSoon: true }, { enrolled: true }))).toBe('enrolled');
    expect(ctaState(page({ isComingSoon: true }, { hasPendingPayment: true }))).toBe('soon');
    expect(ctaState(page({ codeActivationOnly: true }, { hasPendingPayment: true }))).toBe('pending');
    expect(ctaState(page({ codeActivationOnly: true, isFree: true }))).toBe('code');
    expect(ctaState(page({ isFree: true, price: null }))).toBe('free');
    expect(ctaState(page())).toBe('paid');
  });

  it('sends students under 18 to a parent for paid courses, but keeps free and code courses open', () => {
    expect(ctaState(page({}, { signedIn: true, mustAskParent: true }))).toBe('askParent');
    expect(ctaState(page({ isFree: true, price: null }, { signedIn: true, mustAskParent: true }))).toBe('free');
    expect(ctaState(page({ codeActivationOnly: true }, { signedIn: true, mustAskParent: true }))).toBe('code');
  });

  it("follows the chosen child for a parent, not the parent's own enrolment", () => {
    const child = { userId: 'c1', name: 'Lina', enrolled: false, hasPendingPayment: false };
    expect(ctaState(page({}, { signedIn: true, enrolled: true }), child)).toBe('paid');
    expect(ctaState(page({}, { signedIn: true }), { ...child, enrolled: true })).toBe('enrolled');
    expect(ctaState(page({}, { signedIn: true, isStaff: true }), child)).toBe('paid');
  });

  it('offers codes instead of a broken Buy button when online payment is off', () => {
    expect(ctaState(page({}, {}, false))).toBe('paidOff');
    // A pending payment cannot be continued without a provider either.
    expect(ctaState(page({}, { hasPendingPayment: true }, false))).toBe('paidOff');
  });
});

describe('activation code field', () => {
  it('formats while typing and accepts lower case, spaces and Arabic-Indic digits', () => {
    expect(formatCode('ab cd')).toBe('ABCD');
    expect(formatCode('abcd2345efgh')).toBe('ABCD-2345-EFGH');
    expect(formatCode('ABCD-٢٣٤٥-EFGH-XYZ')).toBe('ABCD-2345-EFGH');
  });

  it('maps refusals to calm messages, checking "wrong course" before "invalid"', () => {
    const refused = (status: number, message: string) => new HttpErrorResponse({ status, error: { errors: [message] } });
    expect(codeErrorKey(refused(400, 'This code is not valid for this course.'))).toBe('wrongCourse');
    expect(codeErrorKey(refused(400, 'This code is not valid. Check the letters and numbers on the card.'))).toBe('invalid');
    expect(codeErrorKey(refused(409, 'This code has already been used. Please contact your center.'))).toBe('used');
    expect(codeErrorKey(refused(409, 'You are already enrolled in this course; the code was not used.'))).toBe('already');
    expect(codeErrorKey(refused(409, 'This code was cancelled. Please contact your center.'))).toBe('cancelled');
    expect(codeErrorKey(refused(429, 'Too many wrong codes.'))).toBe('tooMany');
    expect(codeErrorKey(refused(0, ''))).toBe('network');
    // 400s come through the error interceptor already unwrapped.
    expect(codeErrorKey(new ApiValidationError(['This code is not valid.']))).toBe('invalid');
    expect(codeErrorKey(new ApiValidationError(['This code is not valid for this course.']))).toBe('wrongCourse');
  });
});

describe('public names and figures', () => {
  it('builds a monogram from the name, skipping titles and the article', () => {
    expect(initials('أ. هدى العتيبي')).toBe('ه ع');
    expect(initials('عبدالله')).toBe('ع');
    expect(initials('Mr Ali Hassan')).toBe('A H');
    expect(initials('')).toBe('');
  });

  it('shortens buyer names to first name and initial', () => {
    expect(shortName('سارة محمد القحطاني')).toBe('سارة ق.');
    expect(shortName('s.sara')).toBe('s.sara');
  });

  it('writes durations and prices with Western digits', () => {
    const t = (key: string, p?: Record<string, unknown>) => (key.endsWith('hours') ? `${p!['h']} h` : `${p!['m']} min`);
    expect(durationText(150, t)).toBe('2 h 30 min');
    expect(durationText(45, t)).toBe('45 min');
    expect(durationText(0, t)).toBe('');
    expect(formatPrice(149, 'SAR', 'ar')).toMatch(/149/);
    expect(formatPrice(149, 'SAR', 'ar')).not.toMatch(/[٠-٩]/);
  });

  it('keeps the student-home subject colours', () => {
    expect(subjectColor(3)).toBe('var(--color-subject-blue)');
    expect(subjectColor(8)).toBe('var(--color-subject-green)');
    expect(subjectColor(1)).toBe('var(--color-subject-earth)');
  });
});
