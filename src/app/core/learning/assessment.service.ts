import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { ApiEndpoints } from '../constants/api-endpoints';
import { ApiResponse } from '../models/api-response.model';

export type QuestionType = 'MultipleChoice' | 'ShortAnswer' | 'SingleChoice' | 'TrueFalse';

// ---- student --------------------------------------------------------------------------------------------

export type QuizSummary = {
  attemptsUsed: number;
  bestPercent: number | null;
  inProgressAttemptId: string | null;
  lessonId: string;
  maxAttempts: number | null;
  passed: boolean;
  passPercent: number;
  questionCount: number;
  timeLimitMinutes: number | null;
};

export type AttemptQuestion = {
  options: { id: string; text: string }[];
  points: number;
  questionId: string;
  selectedOptionIds: string[];
  text: string;
  textAnswer: string | null;
  type: QuestionType;
};

export type Attempt = { deadlineUtc: string | null; id: string; lessonId: string; questions: AttemptQuestion[]; startedAtUtc: string };

export type Answer = { questionId: string; selectedOptionIds?: string[]; textAnswer?: string | null };

export type AttemptResult = {
  attemptId: string;
  autoSubmitted: boolean;
  items:
    | {
        acceptedAnswers: string[];
        awardedPoints: number;
        correctOptionIds: string[];
        explanation: string | null;
        isCorrect: boolean;
        points: number;
        questionId: string;
        selectedOptionIds: string[];
        textAnswer: string | null;
      }[]
    | null;
  lessonCompleted: boolean;
  maxScore: number;
  passed: boolean;
  percent: number;
  score: number;
};

export type Submission = {
  feedback: string | null;
  gradedAtUtc: string | null;
  id: string;
  isLate: boolean;
  lessonId: string;
  lessonTitle: string | null;
  links: string[];
  maxPoints: number;
  score: number | null;
  status: 'Graded' | 'ReturnedForRevision' | 'Submitted';
  studentName: string | null;
  studentUserName: string | null;
  submittedAtUtc: string;
  text: string | null;
  userId: string;
};

export type StudentAssignment = {
  acceptLateSubmissions: boolean;
  canSubmit: boolean;
  dueAtUtc: string | null;
  lessonId: string;
  maxPoints: number;
  submission: Submission | null;
};

// ---- staff ----------------------------------------------------------------------------------------------

export type QuestionOption = { id?: string; isCorrect: boolean; text: string };

export type Question = {
  acceptedAnswers: string[];
  curriculumId: number | null;
  difficulty: number;
  explanation: string | null;
  gradeId: number | null;
  id: string;
  options: QuestionOption[];
  points: number;
  subjectId: number | null;
  text: string;
  type: QuestionType;
};

export type QuestionInput = Omit<Question, 'id'>;

export type QuizSettings = {
  maxAttempts: number | null;
  passPercent: number;
  questions: { points: number | null; questionId: string }[];
  showAnswersAfterSubmit: boolean;
  shuffleOptions: boolean;
  shuffleQuestions: boolean;
  timeLimitMinutes: number | null;
};

export type Quiz = Omit<QuizSettings, 'questions'> & {
  lessonId: string;
  questions: { order: number; points: number; question: Question; questionId: string }[];
};

export type AssignmentSettings = { acceptLateSubmissions: boolean; dueAtUtc: string | null; lessonId: string; maxPoints: number };

/** Quizzes, assignments and the question bank (student and staff calls). */
@Injectable({ providedIn: 'root' })
export class AssessmentService {
  private http = inject(HttpClient);

  // student
  quizSummary(org: string, lessonId: string): Observable<QuizSummary> {
    return this.get(ApiEndpoints.Learn.Quiz(org, lessonId));
  }
  startAttempt(org: string, lessonId: string): Observable<Attempt> {
    return this.post(ApiEndpoints.Learn.StartAttempt(org, lessonId), {});
  }
  saveAnswers(org: string, attemptId: string, answers: Answer[]): Observable<Attempt> {
    return this.put(ApiEndpoints.Learn.AttemptAnswers(org, attemptId), { answers });
  }
  submitAttempt(org: string, attemptId: string, answers: Answer[]): Observable<AttemptResult> {
    return this.post(ApiEndpoints.Learn.SubmitAttempt(org, attemptId), { answers });
  }
  assignment(org: string, lessonId: string): Observable<StudentAssignment> {
    return this.get(ApiEndpoints.Learn.Assignment(org, lessonId));
  }
  submitAssignment(org: string, lessonId: string, text: string | null, links: string[]): Observable<Submission> {
    return this.put(ApiEndpoints.Learn.Submission(org, lessonId), { text, links });
  }

  // staff
  questions(org: string, search?: string): Observable<Question[]> {
    const url = ApiEndpoints.Assessments.Questions(org) + (search ? `?search=${encodeURIComponent(search)}` : '');
    return this.get(url);
  }
  createQuestion(org: string, question: QuestionInput): Observable<Question> {
    return this.post(ApiEndpoints.Assessments.Questions(org), question);
  }
  updateQuestion(org: string, id: string, question: QuestionInput): Observable<Question> {
    return this.put(ApiEndpoints.Assessments.Question(org, id), question);
  }
  deleteQuestion(org: string, id: string): Observable<boolean> {
    return this.http.delete<ApiResponse<boolean>>(ApiEndpoints.Assessments.Question(org, id)).pipe(map(r => r.data));
  }
  quiz(org: string, courseId: string, lessonId: string): Observable<Quiz> {
    return this.get(ApiEndpoints.Assessments.Quiz(org, courseId, lessonId));
  }
  saveQuiz(org: string, courseId: string, lessonId: string, settings: QuizSettings): Observable<Quiz> {
    return this.put(ApiEndpoints.Assessments.Quiz(org, courseId, lessonId), settings);
  }
  assignmentSettings(org: string, courseId: string, lessonId: string): Observable<AssignmentSettings> {
    return this.get(ApiEndpoints.Assessments.Assignment(org, courseId, lessonId));
  }
  saveAssignmentSettings(org: string, courseId: string, lessonId: string, settings: Omit<AssignmentSettings, 'lessonId'>): Observable<AssignmentSettings> {
    return this.put(ApiEndpoints.Assessments.Assignment(org, courseId, lessonId), settings);
  }
  submissions(org: string, courseId: string, pendingOnly: boolean): Observable<Submission[]> {
    return this.get(ApiEndpoints.Assessments.Submissions(org, courseId, pendingOnly));
  }
  grade(org: string, submissionId: string, grade: { feedback: string | null; returnForRevision: boolean; score: number | null }): Observable<Submission> {
    return this.put(ApiEndpoints.Assessments.Grade(org, submissionId), grade);
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
}
