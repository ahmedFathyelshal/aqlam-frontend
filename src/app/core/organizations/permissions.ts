/**
 * Mirror of the backend role → permission matrix (AqlamAcademy.Application/Common/Authorization/Permissions.cs).
 * Used only to show or hide UI; the API enforces every permission itself.
 */
export type Permission =
  | 'courses.view'
  | 'courses.edit'
  | 'courses.publish'
  | 'members.view'
  | 'members.manage'
  | 'classes.manage'
  | 'attendance.take'
  | 'announcements.send'
  | 'children.view'
  | 'grades.edit'
  | 'finance.view'
  | 'org.settings';

const ROLE_GRANTS: Record<string, Permission[]> = {
  Owner: ['courses.view', 'courses.edit', 'courses.publish', 'members.view', 'members.manage', 'classes.manage', 'attendance.take', 'announcements.send', 'grades.edit', 'finance.view', 'org.settings'],
  Admin: ['courses.view', 'courses.edit', 'courses.publish', 'members.view', 'members.manage', 'classes.manage', 'attendance.take', 'announcements.send', 'grades.edit', 'org.settings'],
  AcademicCoordinator: ['courses.view', 'courses.edit', 'courses.publish', 'members.view', 'classes.manage', 'attendance.take', 'announcements.send', 'grades.edit'],
  Teacher: ['courses.view', 'courses.edit', 'members.view', 'attendance.take', 'announcements.send', 'grades.edit'],
  Assistant: ['courses.view', 'members.view', 'attendance.take'],
  Finance: ['finance.view', 'members.view'],
  Student: [],
  Parent: ['children.view'],
};

export function grants(roles: readonly string[], permission: Permission): boolean {
  return roles.some(role => ROLE_GRANTS[role]?.includes(permission));
}
