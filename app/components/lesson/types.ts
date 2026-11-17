import type { RenderedComment } from "~/components/comment-thread";
import type { DenialReason } from "~/modules/permissions/course-permissions.server";

export type LessonCourse = { id: number; title: string; slug: string };

export type CurriculumModule = {
  id: number;
  title: string;
  lessons: Array<{ id: number; title: string }>;
};

export type LessonQuiz = {
  id: number;
  title: string;
  passingScore: number;
  questions: Array<{
    id: number;
    questionText: string;
    questionType: string;
    position: number;
    options: Array<{ id: number; optionText: string }>;
  }>;
};

export type BestAttempt = { score: number; passed: boolean } | null;

export type QuizResult = {
  attemptId: number;
  score: number;
  passed: boolean;
  grade: string;
  totalCorrect: number;
  totalQuestions: number;
  questionResults: Array<{
    questionId: number;
    correct: boolean;
    selectedOptionId: number | null;
    correctOptionId: number | null;
  }>;
};

export type LessonNoteData = { body: string; updatedAt: string } | null;

export type NavLesson = { id: number; title: string } | null;

export type LockedLessonData = {
  view: "locked";
  course: LessonCourse;
  curriculum: CurriculumModule[];
  module: { id: number; title: string };
  lesson: { id: number; title: string };
  enrolled: boolean;
  lockedReason: DenialReason;
};

export type FullLessonData = {
  view: "full";
  course: LessonCourse;
  curriculum: CurriculumModule[];
  module: { id: number; title: string };
  lesson: {
    id: number;
    title: string;
    videoUrl: string | null;
    githubRepoUrl: string | null;
    durationMinutes: number | null;
  };
  contentHtml: string | null;
  lessonStatus: string | null;
  enrolled: boolean;
  currentUserId: number | null;
  prevLesson: NavLesson;
  nextLesson: NavLesson;
  quiz: LessonQuiz | null;
  bestAttempt: BestAttempt;
  lastWatchPosition: number;
  watchProgress: number;
  lessonProgressMap: Record<number, string>;
  comments: RenderedComment[];
  canModerate: boolean;
  instructorName: string;
  bookmarked: boolean;
  note: LessonNoteData;
};
