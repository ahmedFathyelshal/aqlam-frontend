import { environment } from '../../../environments/environment';

const buildUrl = (path: string) => `${environment.apiUrl}${path}`;

/** Tenant-scoped endpoints live under /orgs/{org} on the main domain. */
const orgUrl = (org: string, path: string) => buildUrl(`/orgs/${encodeURIComponent(org)}${path}`);

export const ApiEndpoints = {
  Auth: {
    Login: buildUrl('/Auth/login'),
    Register: buildUrl('/Auth/register'),
    Refresh: buildUrl('/Auth/refresh'),
    Logout: buildUrl('/Auth/logout'),
    Me: buildUrl('/Auth/me'),
  },
  Me: {
    Memberships: buildUrl('/me/memberships'),
    Courses: buildUrl('/me/courses'),
    Join: buildUrl('/me/join'),
  },
  Learn: {
    Course: (org: string, courseId: string) => orgUrl(org, `/learn/courses/${courseId}`),
    Enroll: (org: string, courseId: string) => orgUrl(org, `/learn/courses/${courseId}/enroll`),
    Lesson: (org: string, lessonId: string) => orgUrl(org, `/learn/lessons/${lessonId}`),
    Progress: (org: string, lessonId: string) => orgUrl(org, `/learn/lessons/${lessonId}/progress`),
    Quiz: (org: string, lessonId: string) => orgUrl(org, `/learn/lessons/${lessonId}/quiz`),
    StartAttempt: (org: string, lessonId: string) => orgUrl(org, `/learn/lessons/${lessonId}/quiz/attempts`),
    AttemptAnswers: (org: string, attemptId: string) => orgUrl(org, `/learn/attempts/${attemptId}/answers`),
    SubmitAttempt: (org: string, attemptId: string) => orgUrl(org, `/learn/attempts/${attemptId}/submit`),
    Assignment: (org: string, lessonId: string) => orgUrl(org, `/learn/lessons/${lessonId}/assignment`),
    Submission: (org: string, lessonId: string) => orgUrl(org, `/learn/lessons/${lessonId}/assignment/submission`),
  },
  Lookups: {
    Curricula: (countryCode?: string) => countryCode ? buildUrl(`/lookups/curricula?countryCode=${countryCode}`) : buildUrl('/lookups/curricula'),
    EducationStages: (curriculumId?: number) => curriculumId ? buildUrl(`/lookups/education-stages?curriculumId=${curriculumId}`) : buildUrl('/lookups/education-stages'),
    EducationGrades: (stageId?: number) => stageId ? buildUrl(`/lookups/education-grades?stageId=${stageId}`) : buildUrl('/lookups/education-grades'),
    Subjects: buildUrl('/lookups/subjects'),
  },
  Assessments: {
    Questions: (org: string) => orgUrl(org, '/questions'),
    Question: (org: string, id: string) => orgUrl(org, `/questions/${id}`),
    Quiz: (org: string, courseId: string, lessonId: string) => orgUrl(org, `/courses/${courseId}/lessons/${lessonId}/quiz`),
    Assignment: (org: string, courseId: string, lessonId: string) => orgUrl(org, `/courses/${courseId}/lessons/${lessonId}/assignment`),
    Submissions: (org: string, courseId: string, pendingOnly: boolean) => orgUrl(org, `/courses/${courseId}/submissions?pending=${pendingOnly}`),
    Grade: (org: string, submissionId: string) => orgUrl(org, `/submissions/${submissionId}/grade`),
  },
  TeacherCourses: {
    Draft: (org: string) => orgUrl(org, '/courses/draft'),
    GetDraft: (org: string, id: string) => orgUrl(org, `/courses/${id}/draft`),
    UpdateIdentity: (org: string, id: string) => orgUrl(org, `/courses/${id}/identity`),
    UpdateCommercials: (org: string, id: string) => orgUrl(org, `/courses/${id}/commercials`),
    UpdateMedia: (org: string, id: string) => orgUrl(org, `/courses/${id}/media`),
    UpdateCurriculum: (org: string, id: string) => orgUrl(org, `/courses/${id}/curriculum`),
    List: (org: string) => orgUrl(org, '/courses'),
    PublishChecklist: (org: string, id: string) => orgUrl(org, `/courses/${id}/publish-checklist`),
    Status: (org: string, id: string) => orgUrl(org, `/courses/${id}/status`),
    Visibility: (org: string, id: string) => orgUrl(org, `/courses/${id}/visibility`),
  }
};
