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
    Notifications: (unreadOnly = false) => buildUrl(`/me/notifications?unreadOnly=${unreadOnly}`),
    NotificationRead: (id: string) => buildUrl(`/me/notifications/${id}/read`),
    NotificationsReadAll: buildUrl('/me/notifications/read-all'),
    Children: buildUrl('/me/children'),
  },
  School: {
    Branches: (org: string) => orgUrl(org, '/branches'),
    Branch: (org: string, id: string) => orgUrl(org, `/branches/${id}`),
    Classes: (org: string, mine = false) => orgUrl(org, `/classes${mine ? '?mine=true' : ''}`),
    Class: (org: string, id: string) => orgUrl(org, `/classes/${id}`),
    ClassStudents: (org: string, id: string) => orgUrl(org, `/classes/${id}/students`),
    ClassStudent: (org: string, id: string, userId: string) => orgUrl(org, `/classes/${id}/students/${userId}`),
    Assignments: (org: string, id: string) => orgUrl(org, `/classes/${id}/assignments`),
    Assignment: (org: string, id: string, assignmentId: string) => orgUrl(org, `/classes/${id}/assignments/${assignmentId}`),
    Attendance: (org: string, classId: string) => orgUrl(org, `/classes/${classId}/attendance`),
    AttendanceSummary: (org: string, classId: string, from: string, to: string) => orgUrl(org, `/classes/${classId}/attendance/summary?from=${from}&to=${to}`),
    Announcements: (org: string) => orgUrl(org, '/announcements'),
    Members: (org: string) => orgUrl(org, '/members'),
    MemberImport: (org: string) => orgUrl(org, '/members/import'),
    MemberImportTemplate: (org: string) => orgUrl(org, '/members/import/template'),
    MemberGender: (org: string, userId: string) => orgUrl(org, `/members/${userId}/gender`),
    Parents: (org: string, studentId: string) => orgUrl(org, `/members/${studentId}/parents`),
    Parent: (org: string, studentId: string, parentId: string) => orgUrl(org, `/members/${studentId}/parents/${parentId}`),
    ParentInvite: (org: string, studentId: string) => orgUrl(org, `/members/${studentId}/parent-invites`),
    Settings: (org: string) => orgUrl(org, '/settings'),
    Child: (org: string, childId: string) => orgUrl(org, `/children/${childId}`),
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
