export enum CourseStatus {
  Draft = 'Draft',
  Scheduled = 'Scheduled',
  Published = 'Published',
  Archived = 'Archived',
  Suspended = 'Suspended'
}

export enum CourseVisibility {
  Private = 'Private',
  Unlisted = 'Unlisted',
  Public = 'Public'
}

export enum PricingType {
  Free = 'Free',
  Paid = 'Paid'
}

export enum AccessExpiryPolicy {
  Unlimited = 'Unlimited',
  Limited = 'Limited'
}

export enum LessonType {
  Video = 'Video',
  Article = 'Article',
  Quiz = 'Quiz',
  Assignment = 'Assignment'
}

export enum ResourceType {
  File = 'File',
  Link = 'Link'
}

export interface LessonResource {
  id?: string;
  displayName: string;
  resourceUrl: string;
  type: ResourceType;
  isDownloadable: boolean;
}

export interface CourseLesson {
  id?: string;
  title: string;
  order: number;
  isPublished: boolean;
  type: LessonType;
  durationInMinutes?: number;
  isFreePreview: boolean;
  videoUrl?: string;
  summary?: string;
  content?: string;
  unlockDaysAfterEnrollment: number;
  requirePreviousLessonCompletion: boolean;
  resources: LessonResource[];
}

export interface CourseChapter {
  id?: string;
  title: string;
  order: number;
  lessons: CourseLesson[];
}

export interface CourseDraft {
  id?: string;
  status: CourseStatus;
  visibility?: CourseVisibility;
  /** Sent back as expectedVersion when saving the curriculum (409 if someone saved in between). */
  curriculumVersion?: number;

  title?: string;
  slug?: string;
  curriculumId?: number;
  stageId?: number;
  gradeId?: number;
  subjectId?: number;

  pricingType?: PricingType;
  price?: number;
  codeActivationOnly?: boolean;
  accessExpiryPolicy?: AccessExpiryPolicy;
  accessDurationDays?: number;

  subtitle?: string;
  thumbnailUrl?: string;
  promoVideoUrl?: string;

  chapters?: CourseChapter[];
  syllabusRequirements?: string;
}

export interface ApiResponse<T> {
  succeeded: boolean;
  errors: string[];
  data: T;
}

export interface UpdateCourseIdentityRequest {
  id: string;
  title?: string;
  slug?: string;
  curriculumId?: number;
  stageId?: number;
  gradeId?: number;
  subjectId?: number;
}

export interface UpdateCourseCommercialsRequest {
  id: string;
  pricingType?: PricingType;
  price?: number;
  codeActivationOnly?: boolean;
  accessExpiryPolicy?: AccessExpiryPolicy;
  accessDurationDays?: number;
}

export interface UpdateCourseMediaRequest {
  id: string;
  subtitle?: string;
  thumbnailUrl?: string;
  promoVideoUrl?: string;
}

/** Chapters without `lessons` keep their lessons unchanged on the server. */
export interface CurriculumChapterInput {
  id?: string;
  title: string;
  lessons?: CourseLesson[];
}

export interface SyncCurriculumRequest {
  expectedVersion: number;
  syllabusRequirements?: string;
  chapters: CurriculumChapterInput[];
}
