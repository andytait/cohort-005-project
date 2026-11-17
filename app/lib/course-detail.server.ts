import { db } from "~/db";
import {
  courses,
  modules,
  lessons,
  lessonProgress,
  courseRatings,
  LessonProgressStatus,
} from "~/db/schema";
import { eq, and, or, sql } from "drizzle-orm";
import { MAX_RATING, MIN_RATING } from "~/lib/ratings";

export function getLessonCountForCourse(courseId: number) {
  const courseModules = db
    .select({ id: modules.id })
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .all();

  if (courseModules.length === 0) return 0;

  const count = db
    .select({ count: sql<number>`count(*)` })
    .from(lessons)
    .where(or(...courseModules.map((m) => eq(lessons.moduleId, m.id))))
    .get();

  return count?.count ?? 0;
}

export function getCourseLessonIds(courseId: number): number[] {
  const courseModules = db
    .select({ id: modules.id })
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .all();

  if (courseModules.length === 0) return [];

  const courseLessons = db
    .select({ id: lessons.id })
    .from(lessons)
    .where(or(...courseModules.map((m) => eq(lessons.moduleId, m.id))))
    .all();

  return courseLessons.map((l) => l.id);
}

export function getLessonProgressForCourse(userId: number, courseId: number) {
  const courseModules = db
    .select({ id: modules.id })
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .all();

  if (courseModules.length === 0) return [];

  const courseLessons = db
    .select({ id: lessons.id })
    .from(lessons)
    .where(or(...courseModules.map((m) => eq(lessons.moduleId, m.id))))
    .all();

  if (courseLessons.length === 0) return [];

  return db
    .select()
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        or(...courseLessons.map((l) => eq(lessonProgress.lessonId, l.id)))
      )
    )
    .all();
}

export function getNextIncompleteLesson(userId: number, courseId: number) {
  const courseModules = db
    .select()
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .orderBy(modules.position)
    .all();

  if (courseModules.length === 0) return null;

  for (const mod of courseModules) {
    const moduleLessons = db
      .select()
      .from(lessons)
      .where(eq(lessons.moduleId, mod.id))
      .orderBy(lessons.position)
      .all();

    for (const lesson of moduleLessons) {
      const progress = db
        .select()
        .from(lessonProgress)
        .where(
          and(
            eq(lessonProgress.userId, userId),
            eq(lessonProgress.lessonId, lesson.id)
          )
        )
        .get();
      if (!progress || progress.status !== LessonProgressStatus.Completed) {
        return lesson;
      }
    }
  }

  return null;
}

type CourseRatingSummary = {
  average: number | null;
  count: number;
};

const EMPTY_SUMMARY: CourseRatingSummary = { average: null, count: 0 };

export function findRating(userId: number, courseId: number) {
  return db
    .select()
    .from(courseRatings)
    .where(
      and(
        eq(courseRatings.userId, userId),
        eq(courseRatings.courseId, courseId)
      )
    )
    .get();
}

export function getCourseRatingSummary(courseId: number): CourseRatingSummary {
  const result = db
    .select({
      average: sql<number | null>`avg(${courseRatings.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(courseRatings)
    .where(eq(courseRatings.courseId, courseId))
    .get();

  if (!result || result.count === 0 || result.average === null) {
    return EMPTY_SUMMARY;
  }

  return {
    average: Math.round(result.average * 10) / 10,
    count: result.count,
  };
}

export function rateCourse(userId: number, courseId: number, rating: number) {
  if (!Number.isInteger(rating) || rating < MIN_RATING || rating > MAX_RATING) {
    throw new Error(
      `Rating must be a whole number between ${MIN_RATING} and ${MAX_RATING}`
    );
  }

  const course = db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.id, courseId))
    .get();

  if (!course) {
    throw new Error("Course not found");
  }

  const existing = findRating(userId, courseId);

  if (existing) {
    return db
      .update(courseRatings)
      .set({ rating, updatedAt: new Date().toISOString() })
      .where(eq(courseRatings.id, existing.id))
      .returning()
      .get();
  }

  return db
    .insert(courseRatings)
    .values({ userId, courseId, rating })
    .returning()
    .get();
}
