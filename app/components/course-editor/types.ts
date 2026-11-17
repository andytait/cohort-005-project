import type { useFetcher } from "react-router";
import type { getCourseWithDetails } from "~/lib/course-editor.server";

export type Fetcher = ReturnType<typeof useFetcher>;

export type EditorCourse = NonNullable<ReturnType<typeof getCourseWithDetails>>;

export type EditorModule = EditorCourse["modules"][number];

export type EditorLesson = EditorModule["lessons"][number];

export type EditorQuizScore = {
  quizId: number;
  quizTitle: string;
  lessonTitle: string;
  bestScore: number | null;
  passed: boolean | null;
};

export type EditorStudent = {
  userId: number;
  name: string;
  email: string;
  enrolledAt: string;
  completedAt: string | null;
  progress: number;
  quizScores: EditorQuizScore[];
};
