import { environment } from '../../../environments/environment';

const buildUrl = (path: string) => `${environment.apiUrl}${path}`;

export const ApiEndpoints = {
  Auth: {
    Login: buildUrl('/Auth/login'),
    Register: buildUrl('/Auth/register'),
    Refresh: buildUrl('/Auth/refresh'),
    Logout: buildUrl('/Auth/logout'),
    Me: buildUrl('/Auth/me'),
  },
  Lookups: {
    EducationStages: buildUrl('/lookups/education-stages'),
    EducationGrades: (stageId?: number) => stageId ? buildUrl(`/lookups/education-grades?stageId=${stageId}`) : buildUrl('/lookups/education-grades'),
    Subjects: buildUrl('/lookups/subjects'),
  },
  TeacherCourses: {
    Draft: buildUrl('/teacher/courses/draft'),
    GetDraft: (id: string) => buildUrl(`/teacher/courses/${id}/draft`),
    UpdateIdentity: (id: string) => buildUrl(`/teacher/courses/${id}/identity`),
    UpdateCommercials: (id: string) => buildUrl(`/teacher/courses/${id}/commercials`),
    UpdateMedia: (id: string) => buildUrl(`/teacher/courses/${id}/media`),
    UpdateCurriculum: (id: string) => buildUrl(`/teacher/courses/${id}/curriculum`),
    CurriculumWorkspace: (id: string) => `/teacher/courses/${id}/curriculum`,
  }
};
