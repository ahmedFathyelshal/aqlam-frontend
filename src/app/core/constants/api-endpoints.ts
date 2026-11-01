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
  },
  Lookups: {
    EducationStages: buildUrl('/lookups/education-stages'),
    EducationGrades: (stageId?: number) => stageId ? buildUrl(`/lookups/education-grades?stageId=${stageId}`) : buildUrl('/lookups/education-grades'),
    Subjects: buildUrl('/lookups/subjects'),
  },
  TeacherCourses: {
    Draft: (org: string) => orgUrl(org, '/courses/draft'),
    GetDraft: (org: string, id: string) => orgUrl(org, `/courses/${id}/draft`),
    UpdateIdentity: (org: string, id: string) => orgUrl(org, `/courses/${id}/identity`),
    UpdateCommercials: (org: string, id: string) => orgUrl(org, `/courses/${id}/commercials`),
    UpdateMedia: (org: string, id: string) => orgUrl(org, `/courses/${id}/media`),
    UpdateCurriculum: (org: string, id: string) => orgUrl(org, `/courses/${id}/curriculum`),
    CurriculumWorkspace: (id: string) => `/teacher/courses/${id}/curriculum`,
  }
};
