import type * as schema from "../../app/db/schema";

export type User = typeof schema.users.$inferSelect;
export type Course = typeof schema.courses.$inferSelect;
export type Category = typeof schema.categories.$inferSelect;

// The rows the hand-written narrative data hangs off.
export type Seeded = {
  admin: User;
  instructor1: User;
  instructor2: User;
  students: User[];
  bossy: User;
  studentByEmail: (email: string) => User;
  course1: Course;
  course2: Course;
  course3: Course;
  course1LessonIds: number[];
  course2LessonIds: number[];
  course3LessonIds: number[];
};
