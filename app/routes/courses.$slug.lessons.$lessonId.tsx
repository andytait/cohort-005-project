import type { Route } from "./+types/courses.$slug.lessons.$lessonId";
import {
  coursePermissions,
  type DenialReason,
} from "~/modules/permissions/course-permissions.server";
import { markdown } from "~/lib/text";
import {
  createComment,
  deleteComment,
  editComment,
} from "~/lib/comments.server";
import { defaultNotifications } from "~/lib/notifications.server";
import { isBookmarked, toggleBookmark } from "~/lib/bookmarks.server";
import { getNote, saveNote } from "~/lib/notes.server";
import { db } from "~/db";
import {
  categories,
  comments,
  courses,
  lessons,
  modules,
  quizzes,
  quizQuestions,
  quizOptions,
  quizAttempts,
  quizAnswers,
  users,
  UserRole,
} from "~/db/schema";
import { and, asc, eq, or } from "drizzle-orm";
import { data } from "react-router";
import { parseFormData } from "~/lib/validation";
import {
  calculateGrade,
  createCommentSchema,
  deleteCommentSchema,
  editCommentSchema,
  flattenCourseLessons,
  getBestAttempt,
  getCommentById,
  getCourseForLesson,
  getLessonById,
  getModuleById,
  getQuizByLessonId,
  getQuizWithQuestions,
  getUserById,
  INTENT_CAPABILITY,
  lessonRef,
  type LessonQuizData,
  type QuestionResult,
  saveNoteSchema,
  type ThreadComment,
} from "~/lib/lesson-viewer.server";
import {
  calculateWatchProgress,
  getLastWatchPosition,
  getLessonProgress,
  getLessonProgressForCourse,
  markLessonComplete,
  markLessonInProgress,
} from "~/lib/lesson-progress.server";
import { renderMarkdown } from "~/lib/markdown.server";
import { FullLesson } from "~/components/lesson/full-lesson";
import { LockedLesson } from "~/components/lesson/locked-lesson";
import { LessonError } from "~/components/lesson/lesson-error";
import { renderThread } from "~/components/lesson/render-thread.server";

function getCourseWithDetails(id: number) {
  const course = db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      description: courses.description,
      salesCopy: courses.salesCopy,
      instructorId: courses.instructorId,
      categoryId: courses.categoryId,
      status: courses.status,
      coverImageUrl: courses.coverImageUrl,
      price: courses.price,
      pppEnabled: courses.pppEnabled,
      createdAt: courses.createdAt,
      updatedAt: courses.updatedAt,
      instructorName: users.name,
      instructorAvatarUrl: users.avatarUrl,
      instructorBio: users.bio,
      categoryName: categories.name,
    })
    .from(courses)
    .innerJoin(users, eq(courses.instructorId, users.id))
    .innerJoin(categories, eq(courses.categoryId, categories.id))
    .where(eq(courses.id, id))
    .get();

  if (!course) return null;

  const courseModules = db
    .select()
    .from(modules)
    .where(eq(modules.courseId, id))
    .orderBy(modules.position)
    .all();

  const moduleIds = courseModules.map((m) => m.id);

  const courseLessons =
    moduleIds.length > 0
      ? db
          .select()
          .from(lessons)
          .where(or(...moduleIds.map((mid) => eq(lessons.moduleId, mid))))
          .orderBy(lessons.position)
          .all()
      : [];

  return {
    ...course,
    modules: courseModules.map((mod) => ({
      ...mod,
      lessons: courseLessons.filter((l) => l.moduleId === mod.id),
    })),
  };
}

function getLessonThread(lessonId: number): ThreadComment[] {
  const course = getCourseForLesson(lessonId);
  if (!course) return [];

  const rows = db
    .select({
      id: comments.id,
      body: comments.body,
      parentId: comments.parentId,
      createdAt: comments.createdAt,
      editedAt: comments.editedAt,
      deletedAt: comments.deletedAt,
      authorId: users.id,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
      authorRole: users.role,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.lessonId, lessonId))
    .orderBy(asc(comments.createdAt), asc(comments.id))
    .all();

  const toThreadComment = (row: (typeof rows)[number]): ThreadComment => {
    const deleted = row.deletedAt !== null;
    return {
      id: row.id,
      body: deleted ? markdown("") : row.body,
      createdAt: row.createdAt,
      editedAt: deleted ? null : row.editedAt,
      deleted,
      author: {
        id: row.authorId,
        name: row.authorName,
        avatarUrl: row.authorAvatarUrl,
        isInstructor: row.authorId === course.instructorId,
        isPlatformAdmin: row.authorRole === UserRole.Admin,
      },
      replies: [],
    };
  };

  const topLevel: ThreadComment[] = [];
  const byId = new Map<number, ThreadComment>();

  for (const row of rows) {
    if (row.parentId !== null) continue;
    const comment = toThreadComment(row);
    byId.set(comment.id, comment);
    topLevel.push(comment);
  }

  for (const row of rows) {
    if (row.parentId === null || row.deletedAt !== null) continue;
    byId.get(row.parentId)?.replies.push(toThreadComment(row));
  }

  // A deleted question with no replies left has nothing worth showing.
  return topLevel.filter((c) => !c.deleted || c.replies.length > 0);
}

function computeResult(
  userId: number,
  quizId: number,
  selectedAnswers: Record<number, number>
) {
  try {
    const quiz = db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
    if (!quiz) {
      console.error("quiz not found");
      return null;
    }

    const questions = db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId))
      .orderBy(quizQuestions.position)
      .all();

    let correct = 0;
    const total = questions.length;
    const questionResults: QuestionResult[] = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const selected = selectedAnswers[q.id];

      if (!selected) {
        questionResults.push({
          questionId: q.id,
          correct: false,
          selectedOptionId: null,
          correctOptionId: null,
        });
        continue;
      }

      let correctOptionId = null;
      if (q.questionType === "multiple_choice") {
        const opts = db
          .select()
          .from(quizOptions)
          .where(eq(quizOptions.questionId, q.id))
          .all();
        const correctOpt = opts.find((o) => o.isCorrect === true);
        correctOptionId = correctOpt ? correctOpt.id : null;
      } else if (q.questionType === "true_false") {
        const correctOpt = db
          .select()
          .from(quizOptions)
          .where(
            and(
              eq(quizOptions.questionId, q.id),
              eq(quizOptions.isCorrect, true)
            )
          )
          .get();
        correctOptionId = correctOpt ? correctOpt.id : null;
      }

      const isCorrect = selected === correctOptionId;
      if (isCorrect) correct++;

      questionResults.push({
        questionId: q.id,
        correct: isCorrect,
        selectedOptionId: selected,
        correctOptionId,
      });
    }

    const scoreValue = total > 0 ? correct / total : 0;
    const passed = scoreValue > 0.7;
    const grade = calculateGrade(scoreValue);

    const attempt = db
      .insert(quizAttempts)
      .values({
        userId,
        quizId,
        score: scoreValue,
        passed,
      })
      .returning()
      .get();

    for (const result of questionResults) {
      if (result.selectedOptionId !== null) {
        db.insert(quizAnswers)
          .values({
            attemptId: attempt.id,
            questionId: result.questionId,
            selectedOptionId: result.selectedOptionId,
          })
          .run();
      }
    }

    return {
      attemptId: attempt.id,
      score: scoreValue,
      passed,
      grade,
      totalCorrect: correct,
      totalQuestions: total,
      questionResults,
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData?.lesson?.title ?? "Lesson";
  const courseTitle = loaderData?.course?.title ?? "Course";
  return [{ title: `${title} | ${courseTitle} | Cadence` }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  // Not found covers an unknown course, a malformed lesson id, and a lesson
  // from another course.
  const decisions = await coursePermissions.getCourseDecisions(
    request,
    lessonRef(params)
  );
  if (!decisions.found) {
    throw data("Lesson not found", { status: 404 });
  }

  const { course, person, enrolled, view, take, manage } = decisions;
  const currentUserId = person?.id ?? null;
  const lessonId = Number(params.lessonId);

  const courseWithDetails = getCourseWithDetails(course.id);
  const lesson = getLessonById(lessonId);
  const mod = lesson ? getModuleById(lesson.moduleId) : undefined;
  if (!courseWithDetails || !lesson || !mod) {
    throw data("Lesson not found", { status: 404 });
  }

  const curriculum = courseWithDetails.modules.map((m) => ({
    id: m.id,
    title: m.title,
    lessons: m.lessons.map((l) => ({
      id: l.id,
      title: l.title,
    })),
  }));

  // Someone who can't view the content gets the lesson's title, its module and
  // the course outline — never the body, video or quiz — plus the reason, so
  // the page can show the right call to action.
  if (!view.allowed) {
    const lockedReason: DenialReason = view.reason;

    return {
      view: "locked" as const,
      course: {
        id: courseWithDetails.id,
        title: courseWithDetails.title,
        slug: courseWithDetails.slug,
      },
      curriculum,
      module: { id: mod.id, title: mod.title },
      lesson: { id: lesson.id, title: lesson.title },
      enrolled,
      lockedReason,
    };
  }

  let lessonStatus: string | null = null;
  let lastWatchPosition = 0;
  let watchProgress = 0;
  const lessonProgressMap: Record<number, string> = {};

  if (currentUserId) {
    // Progress is recorded only for people who can take the course, so a
    // Student under a Country Lock gets none.
    if (take.allowed) {
      // Mark lesson as in-progress when viewed
      markLessonInProgress(currentUserId, lessonId);
      const progress = getLessonProgress(currentUserId, lessonId);
      lessonStatus = progress?.status ?? null;

      // Get progress for all lessons in course (for curriculum sidebar)
      const progressRecords = getLessonProgressForCourse(
        currentUserId,
        course.id
      );
      for (const record of progressRecords) {
        lessonProgressMap[record.lessonId] = record.status;
      }

      // Get video watch state for resume and progress display
      if (lesson.videoUrl) {
        lastWatchPosition = getLastWatchPosition(currentUserId, lessonId);
        const videoDurationSeconds = (lesson.durationMinutes ?? 0) * 60;
        if (videoDurationSeconds > 0) {
          watchProgress = calculateWatchProgress(
            currentUserId,
            lessonId,
            videoDurationSeconds
          );
        }
      }
    }
  }

  // Everything from here on is behind the can-view-content bar above:
  // comments, Bookmarks and Notes are confidential to the course.
  const instructor = getUserById(course.instructorId);
  const comments = await renderThread(getLessonThread(lessonId));

  const bookmarked = currentUserId
    ? isBookmarked(db, currentUserId, lessonId)
    : false;
  const note = currentUserId ? getNote(db, currentUserId, lessonId) : undefined;

  // Render lesson content from Markdown to HTML server-side
  const contentHtml = lesson.content
    ? await renderMarkdown(lesson.content)
    : null;

  // Build prev/next navigation
  const allLessons = flattenCourseLessons(courseWithDetails);
  const currentIndex = allLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson =
    currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  // Check for quiz attached to this lesson
  const quizRecord = getQuizByLessonId(lessonId);
  let quiz: LessonQuizData | null = null;
  let bestAttempt: { score: number; passed: boolean } | null = null;

  if (quizRecord) {
    const quizData = getQuizWithQuestions(quizRecord.id);
    if (quizData) {
      // Strip isCorrect from options so answers aren't leaked to the client
      quiz = {
        id: quizData.id,
        title: quizData.title,
        passingScore: quizData.passingScore,
        questions: quizData.questions.map((q) => ({
          id: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          position: q.position,
          options: q.options.map((o) => ({
            id: o.id,
            optionText: o.optionText,
          })),
        })),
      };
    }

    if (currentUserId) {
      const best = getBestAttempt(currentUserId, quizRecord.id);
      if (best) {
        bestAttempt = { score: best.score, passed: best.passed };
      }
    }
  }

  return {
    view: "full" as const,
    course: {
      id: courseWithDetails.id,
      title: courseWithDetails.title,
      slug: courseWithDetails.slug,
    },
    curriculum,
    module: {
      id: mod.id,
      title: mod.title,
    },
    lesson,
    contentHtml,
    lessonStatus,
    enrolled,
    currentUserId,
    prevLesson,
    nextLesson,
    quiz,
    bestAttempt,
    lastWatchPosition,
    watchProgress,
    lessonProgressMap,
    comments,
    canModerate: manage.allowed,
    instructorName: instructor?.name ?? "your instructor",
    bookmarked,
    note: note ? { body: note.body, updatedAt: note.updatedAt } : null,
  };
}

export async function action({ params, request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  // Every intent checks its own capability here — loader guards don't protect
  // actions. The ref includes the lesson, so a lesson from another course (or
  // a malformed id) is a 404.
  const capability =
    typeof intent === "string" ? INTENT_CAPABILITY[intent] : undefined;
  if (!capability) {
    throw data("Invalid action", { status: 400 });
  }
  const ref = lessonRef(params);
  const { person } = await coursePermissions.requireCapability(
    request,
    capability,
    ref
  );
  const currentUserId = person.id;
  const lessonId = Number(params.lessonId);

  if (
    intent === "create-comment" ||
    intent === "edit-comment" ||
    intent === "delete-comment"
  ) {
    try {
      if (intent === "create-comment") {
        const parsed = parseFormData(formData, createCommentSchema);
        if (!parsed.success) {
          return { ok: false, error: "Enter a comment before posting." };
        }
        const created = await createComment(
          db,
          currentUserId,
          lessonId,
          parsed.data.parentId ?? null,
          parsed.data.body,
          new Date(),
          await defaultNotifications()
        );
        if (!created.ok) return created;
        return { ok: true };
      }

      if (intent === "edit-comment") {
        const parsed = parseFormData(formData, editCommentSchema);
        if (!parsed.success) {
          return { ok: false, error: "Enter a comment before saving." };
        }
        // Scope the id to this lesson so a comment elsewhere can't be reached
        // by posting its id to this route.
        const existing = getCommentById(parsed.data.commentId);
        if (!existing || existing.lessonId !== lessonId) {
          throw data("Comment not found", { status: 404 });
        }
        const edited = editComment(
          db,
          parsed.data.commentId,
          currentUserId,
          parsed.data.body,
          new Date()
        );
        if (!edited.ok) return edited;
        return { ok: true };
      }

      const parsed = parseFormData(formData, deleteCommentSchema);
      if (!parsed.success) {
        return { ok: false, error: "Could not delete that comment." };
      }
      const existing = getCommentById(parsed.data.commentId);
      if (!existing || existing.lessonId !== lessonId) {
        throw data("Comment not found", { status: 404 });
      }
      // Anyone who can view may delete their own posts; moderating someone
      // else's takes the manage capability.
      const decisions = coursePermissions.decide(person, ref);
      const canModerate = decisions.found && decisions.manage.allowed;
      const deleted = await deleteComment(
        db,
        parsed.data.commentId,
        currentUserId,
        canModerate,
        new Date(),
        await defaultNotifications()
      );
      if (!deleted.ok) return deleted;
      return { ok: true };
    } catch (error) {
      // Service validation failures are user-correctable; anything thrown as a
      // Response (404 above) should keep bubbling.
      if (error instanceof Error) {
        return { ok: false, error: error.message };
      }
      throw error;
    }
  }

  if (intent === "toggle-bookmark" || intent === "save-note") {
    if (intent === "toggle-bookmark") {
      const bookmarked = toggleBookmark(
        db,
        currentUserId,
        lessonId,
        new Date()
      );
      return { ok: true, bookmarked };
    }

    const parsed = parseFormData(formData, saveNoteSchema);
    if (!parsed.success) {
      return { ok: false, error: parsed.errors.body };
    }
    const saved = saveNote(
      db,
      currentUserId,
      lessonId,
      parsed.data.body,
      new Date()
    );
    if (!saved.ok) return saved;
    return { ok: true };
  }

  if (intent === "mark-complete") {
    markLessonComplete(currentUserId, lessonId);
    return { success: true };
  }

  if (intent === "submit-quiz") {
    const quizId = Number(formData.get("quizId"));
    if (isNaN(quizId)) {
      throw data("Invalid quiz ID", { status: 400 });
    }
    // Scope the quiz to this lesson so a quiz elsewhere can't be reached by
    // posting its id to this route.
    const quiz = db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
    if (!quiz || quiz.lessonId !== lessonId) {
      throw data("Quiz not found", { status: 404 });
    }

    // Collect answers: form fields named "question-{questionId}" with value = optionId
    const selectedAnswers: Record<number, number> = {};
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("question-")) {
        const questionId = Number(key.replace("question-", ""));
        const optionId = Number(value);
        if (!isNaN(questionId) && !isNaN(optionId)) {
          selectedAnswers[questionId] = optionId;
        }
      }
    }

    const result = computeResult(currentUserId, quizId, selectedAnswers);
    if (!result) {
      throw data("Failed to score quiz", { status: 500 });
    }

    return { quizResult: result };
  }

  throw data("Invalid action", { status: 400 });
}

export default function LessonViewer({ loaderData }: Route.ComponentProps) {
  if (loaderData.view === "locked") {
    return <LockedLesson data={loaderData} />;
  }
  return <FullLesson data={loaderData} />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <LessonError error={error} />;
}
