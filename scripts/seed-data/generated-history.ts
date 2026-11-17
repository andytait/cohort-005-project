import * as schema from "../../app/db/schema";
import { db } from "./db";
import type { Course, Seeded } from "./types";

export function loadLessonDurationSeconds() {
  return new Map(
    db
      .select({
        id: schema.lessons.id,
        durationMinutes: schema.lessons.durationMinutes,
      })
      .from(schema.lessons)
      .all()
      .map((l) => [l.id, (l.durationMinutes ?? 10) * 60] as const)
  );
}

// ─── Drop-off cliffs ───
//
// Progress is not spread evenly through a course. Each course has two lessons
// where a large share of students stop for good, and the analytics work is
// expected to surface exactly these lessons. They are, by lesson index
// (0-based, in course order):
//
//   Course 1 — Introduction to TypeScript
//     index 8  "Generics Basics"                 — first cliff
//     index 13 "Mapped Types"                    — second cliff
//
//   Course 2 — Building REST APIs with Node.js
//     index 5  "Custom Middleware"               — first cliff
//     index 11 "Transactions"                    — second cliff
//
//   Course 3 — Design Systems with Tailwind
//     index 3  "Variants and Composition"        — first cliff
//     index 6  "Documentation That Gets Read"    — second cliff
//
// Assert against the lessons, not against a drop-off percentage. Each enrolment
// rolls: 12% never start, 38% stop at the first cliff, 22% at the second, 13%
// finish, and the remaining 15% stop at a uniformly random lesson — so the
// cliffs stand out against a noisy background rather than being the only
// stopping points. Those are per-enrolment odds, not the share of students who
// reach a given lesson: because students who stop at the first cliff never
// reach the second, the observed drop-off at each cliff is much steeper than
// its roll.

export type SellableCourse = {
  course: Course;
  lessonIds: number[];
  // [bigCliffIndex, secondCliffIndex] — the lesson a stopping student last
  // completed.
  cliffs: [number, number];
};

export function sellableCoursesFor(seeded: Seeded): SellableCourse[] {
  const { course1, course2, course3 } = seeded;
  const { course1LessonIds, course2LessonIds, course3LessonIds } = seeded;

  return [
    { course: course1, lessonIds: course1LessonIds, cliffs: [8, 13] },
    { course: course2, lessonIds: course2LessonIds, cliffs: [5, 11] },
    { course: course3, lessonIds: course3LessonIds, cliffs: [3, 6] },
  ];
}

export const fullPriceCountries = ["US", "GB", "DE", "CA", "AU", "NL"];
export const pppCountries = ["IN", "BR", "PH", "NG", "ID", "VN"];
