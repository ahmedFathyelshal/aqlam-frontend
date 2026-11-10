import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { ApiEndpoints } from '../constants/api-endpoints';
import { ApiResponse } from '../models/api-response.model';

export type GenderSegment = 'Mixed' | 'Boys' | 'Girls';
export type Gender = 'Male' | 'Female';
export type ClassKind = 'Section' | 'Group';
export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';
export type AnnouncementScope = 'Organization' | 'Grade' | 'Class';
export type AnnouncementAudience = 'Students' | 'Parents' | 'Staff';

export type Branch = { id: string; name: string; gender: GenderSegment; address: string | null };

export type WeeklySlot = { day: string; startTime: string; endTime: string };

export type ClassSummary = {
  id: string;
  name: string;
  kind: ClassKind;
  gender: GenderSegment;
  branchId: string | null;
  branchName: string | null;
  curriculumId: number | null;
  gradeId: number | null;
  homeroomTeacherUserId: string | null;
  homeroomTeacherName: string | null;
  capacity: number | null;
  studentCount: number;
  schedule: WeeklySlot[];
  academicYearId: string | null;
};

export type ClassInput = {
  name: string;
  kind: ClassKind;
  gender: GenderSegment;
  branchId: string | null;
  curriculumId: number | null;
  gradeId: number | null;
  homeroomTeacherUserId: string | null;
  capacity: number | null;
  schedule: WeeklySlot[];
  academicYearId: string | null;
};

export type ClassStudent = { userId: string; userName: string; fullName: string; gender: Gender | null; addedAtUtc: string };

export type TeachingAssignment = {
  id: string;
  subjectId: number | null;
  subjectName: string;
  teacherUserId: string;
  teacherUserName: string | null;
  teacherName: string | null;
  courseId: string;
  courseStatus: string | null;
  curriculumId: number | null;
};

export type ClassDetail = { class: ClassSummary; students: ClassStudent[]; assignments: TeachingAssignment[] };

export type RosterResult = { userName: string; status: 'Added' | 'AlreadyInClass' | 'Failed'; error: string | null };

export type AttendanceLine = { userId: string; userName: string; fullName: string; status: AttendanceStatus | null; note: string | null };

export type AttendanceSheet = {
  classGroupId: string;
  className: string;
  date: string;
  startTime: string | null;
  isTaken: boolean;
  takenAtUtc: string | null;
  takenByName: string | null;
  lines: AttendanceLine[];
};

export type AttendanceMark = { userId: string; status: AttendanceStatus; note: string | null };

export type AttendanceSummaryRow = { userId: string; userName: string; fullName: string; present: number; absent: number; late: number; excused: number };

export type Announcement = {
  id: string;
  title: string;
  body: string;
  scope: AnnouncementScope;
  gradeId: number | null;
  classGroupId: string | null;
  className: string | null;
  audience: AnnouncementAudience[];
  sendEmail: boolean;
  authorName: string | null;
  publishedAtUtc: string;
  recipientCount: number;
};

export type NewAnnouncement = {
  title: string;
  body: string;
  scope: AnnouncementScope;
  gradeId: number | null;
  classGroupId: string | null;
  audience: AnnouncementAudience[];
  sendEmail: boolean;
};

export type Member = {
  userId: string;
  userName: string;
  fullName: string;
  roles: string[];
  status: string;
  source: string;
  joinedAtUtc: string;
  gender: Gender | null;
};

export type MemberImportReport = {
  created: number;
  failed: number;
  rows: { rowNumber: number; fullName: string; role: string; status: 'Created' | 'Failed'; userName: string | null; temporaryPassword: string | null; errors: string[] }[];
};

export type ParentLink = { userId: string; userName: string; fullName: string; phoneNumber: string | null; linkedAtUtc: string };
export type ParentInvite = { code: string; childName: string; expiresAtUtc: string };

export type OrganizationSettings = {
  name: string;
  slug: string;
  type: string;
  countryCode: string;
  currency: string;
  timeZone: string;
  calendar: 'Gregorian' | 'Hijri' | 'Both';
  weekStartDay: string;
  logoUrl: string | null;
  primaryColor: string | null;
  gradingScale: 'Percent' | 'Letters' | 'Descriptive';
  contactPhone: string | null;
  contactEmail: string | null;
  followUpAbsentDays: number;
  followUpLateDays: number;
  goodGradePercent: number;
  lowGradePercent: number;
  achievementPercent: number;
};

/** Classes, rosters, attendance, announcements, members and settings of an organization. */
@Injectable({ providedIn: 'root' })
export class SchoolService {
  private http = inject(HttpClient);

  // ---- branches & classes -----------------------------------------------------------------------------
  branches(org: string): Observable<Branch[]> {
    return this.get(ApiEndpoints.School.Branches(org));
  }

  saveBranch(org: string, branch: { id?: string; name: string; gender: GenderSegment; address: string | null }): Observable<Branch> {
    return branch.id
      ? this.put(ApiEndpoints.School.Branch(org, branch.id), branch)
      : this.post(ApiEndpoints.School.Branches(org), branch);
  }

  deleteBranch(org: string, id: string): Observable<boolean> {
    return this.del(ApiEndpoints.School.Branch(org, id));
  }

  classes(org: string, mine = false): Observable<ClassSummary[]> {
    return this.get(ApiEndpoints.School.Classes(org, mine));
  }

  classDetail(org: string, id: string): Observable<ClassDetail> {
    return this.get(ApiEndpoints.School.Class(org, id));
  }

  saveClass(org: string, id: string | null, input: ClassInput): Observable<ClassSummary> {
    return id ? this.put(ApiEndpoints.School.Class(org, id), input) : this.post(ApiEndpoints.School.Classes(org), input);
  }

  deleteClass(org: string, id: string): Observable<boolean> {
    return this.del(ApiEndpoints.School.Class(org, id));
  }

  addStudents(org: string, classId: string, userNames: string[]): Observable<RosterResult[]> {
    return this.post(ApiEndpoints.School.ClassStudents(org, classId), { userNames });
  }

  removeStudent(org: string, classId: string, userId: string): Observable<boolean> {
    return this.del(ApiEndpoints.School.ClassStudent(org, classId, userId));
  }

  assignTeacher(org: string, classId: string, body: { subjectId: number | null; subjectName: string | null; teacherUserId: string; curriculumId: number | null }): Observable<TeachingAssignment> {
    return this.post(ApiEndpoints.School.Assignments(org, classId), body);
  }

  changeTeacher(org: string, classId: string, assignmentId: string, teacherUserId: string): Observable<TeachingAssignment> {
    return this.put(ApiEndpoints.School.Assignment(org, classId, assignmentId), { teacherUserId });
  }

  removeAssignment(org: string, classId: string, assignmentId: string): Observable<boolean> {
    return this.del(ApiEndpoints.School.Assignment(org, classId, assignmentId));
  }

  // ---- attendance -------------------------------------------------------------------------------------
  attendance(org: string, classId: string, date: string, startTime: string | null): Observable<AttendanceSheet> {
    const time = startTime ? `&startTime=${startTime}` : '';
    return this.get(`${ApiEndpoints.School.Attendance(org, classId)}?date=${date}${time}`);
  }

  saveAttendance(org: string, classId: string, date: string, startTime: string | null, marks: AttendanceMark[]): Observable<AttendanceSheet> {
    return this.put(ApiEndpoints.School.Attendance(org, classId), { date, startTime, marks });
  }

  attendanceSummary(org: string, classId: string, from: string, to: string): Observable<AttendanceSummaryRow[]> {
    return this.get(ApiEndpoints.School.AttendanceSummary(org, classId, from, to));
  }

  // ---- announcements ----------------------------------------------------------------------------------
  announcements(org: string): Observable<Announcement[]> {
    return this.get(ApiEndpoints.School.Announcements(org));
  }

  publishAnnouncement(org: string, announcement: NewAnnouncement): Observable<Announcement> {
    return this.post(ApiEndpoints.School.Announcements(org), announcement);
  }

  // ---- members & parents ------------------------------------------------------------------------------
  members(org: string): Observable<Member[]> {
    return this.get(ApiEndpoints.School.Members(org));
  }

  addMember(org: string, userName: string, roles: string[]): Observable<Member> {
    return this.post(ApiEndpoints.School.Members(org), { userName, roles });
  }

  /** Creates accounts from an Excel sheet; the report holds the only copy of the temporary passwords. */
  importMembers(org: string, file: File): Observable<MemberImportReport> {
    const body = new FormData();
    body.append('file', file);
    return this.post(ApiEndpoints.School.MemberImport(org), body);
  }

  importTemplate(org: string): Observable<Blob> {
    return this.http.get(ApiEndpoints.School.MemberImportTemplate(org), { responseType: 'blob' });
  }

  approveMember(org: string, userId: string): Observable<Member> {
    return this.post(ApiEndpoints.School.MemberApprove(org, userId), {});
  }

  setGender(org: string, userId: string, gender: Gender | null): Observable<Member> {
    return this.put(ApiEndpoints.School.MemberGender(org, userId), { gender });
  }

  parents(org: string, studentId: string): Observable<ParentLink[]> {
    return this.get(ApiEndpoints.School.Parents(org, studentId));
  }

  linkParent(org: string, studentId: string, parentUserName: string): Observable<ParentLink> {
    return this.post(ApiEndpoints.School.Parents(org, studentId), { parentUserName });
  }

  unlinkParent(org: string, studentId: string, parentId: string): Observable<boolean> {
    return this.del(ApiEndpoints.School.Parent(org, studentId, parentId));
  }

  parentInvite(org: string, studentId: string): Observable<ParentInvite> {
    return this.post(ApiEndpoints.School.ParentInvite(org, studentId), {});
  }

  exportAttendance(org: string, classId: string, from: string, to: string): Observable<Blob> {
    return this.http.get(ApiEndpoints.School.AttendanceExport(org, classId, from, to), { responseType: 'blob' });
  }

  // ---- settings ---------------------------------------------------------------------------------------
  settings(org: string): Observable<OrganizationSettings> {
    return this.get(ApiEndpoints.School.Settings(org));
  }

  saveSettings(org: string, settings: Omit<OrganizationSettings, 'slug' | 'type' | 'countryCode' | 'currency'>): Observable<OrganizationSettings> {
    return this.put(ApiEndpoints.School.Settings(org), settings);
  }

  private get<T>(url: string): Observable<T> {
    return this.http.get<ApiResponse<T>>(url).pipe(map(r => r.data));
  }

  private post<T>(url: string, body: unknown): Observable<T> {
    return this.http.post<ApiResponse<T>>(url, body).pipe(map(r => r.data));
  }

  private put<T>(url: string, body: unknown): Observable<T> {
    return this.http.put<ApiResponse<T>>(url, body).pipe(map(r => r.data));
  }

  private del<T>(url: string): Observable<T> {
    return this.http.delete<ApiResponse<T>>(url).pipe(map(r => r.data));
  }
}
