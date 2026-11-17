import type { loadLessonPage } from "./lib/load";

/** What the Lesson page renders: the full Lesson, or the locked outline. */
export type LessonPage = Awaited<ReturnType<typeof loadLessonPage>>;
export type FullLessonPage = Extract<LessonPage, { view: "full" }>;
export type LockedLessonPage = Extract<LessonPage, { view: "locked" }>;
