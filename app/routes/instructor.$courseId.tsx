import { useState, useEffect } from "react";
import { Link, useFetcher } from "react-router";
import { toast } from "sonner";
import type { DropResult } from "@hello-pangea/dnd";
import type { Route } from "./+types/instructor.$courseId";
import { coursePermissions } from "~/modules/permissions/course-permissions.server";
import { markdown } from "~/lib/text";
import { db } from "~/db";
import { lessons } from "~/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  courseEditorActionSchema,
  getUserById,
  getCourseWithDetails,
  getLessonCountForCourse,
  updateCourse,
  updateCourseStatus,
  updateCourseSalesCopy,
  updateCoursePrice,
  updateCoursePppEnabled,
  getModuleById,
  createModule,
  updateModuleTitle,
  deleteModule,
  reorderModules,
  getLessonById,
  updateLessonTitle,
  deleteLesson,
  reorderLessons,
  moveLessonToModule,
  getEnrollmentCountForCourse,
  getCourseEnrolledStudents,
  calculateProgress,
  getQuizByLessonId,
  getBestAttempt,
} from "~/lib/course-editor.server";
import {
  CourseEditorBreadcrumb,
  CourseEditorHeader,
  CourseEditorTabsList,
} from "~/components/course-editor/course-editor-header";
import { ModuleList } from "~/components/course-editor/module-list";
import { AddModuleForm } from "~/components/course-editor/add-forms";
import { SettingsTab } from "~/components/course-editor/settings-tab";
import { SalesCopyTab } from "~/components/course-editor/sales-copy-tab";
import { StudentsTab } from "~/components/course-editor/students-tab";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent } from "~/components/ui/tabs";
import { AlertTriangle } from "lucide-react";
import { data, isRouteErrorResponse } from "react-router";
import { parseFormData } from "~/lib/validation";

function createLesson(
  moduleId: number,
  title: string,
  content: string | null,
  videoUrl: string | null,
  position: number | null,
  durationMinutes: number | null
) {
  const pos =
    position ??
    (db
      .select({ max: sql<number>`coalesce(max(${lessons.position}), 0)` })
      .from(lessons)
      .where(eq(lessons.moduleId, moduleId))
      .get()?.max ?? 0) + 1;

  return db
    .insert(lessons)
    .values({
      moduleId,
      title,
      content: content === null ? null : markdown(content),
      videoUrl,
      position: pos,
      durationMinutes,
    })
    .returning()
    .get();
}

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData?.course?.title ?? "Edit Course";
  return [
    { title: `Edit: ${title} | Cadence` },
    { name: "description", content: `Edit course: ${title}` },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const {
    course: { id: courseId },
  } = await coursePermissions.requireCapability(request, "manage", {
    courseId: params.courseId,
  });

  const course = getCourseWithDetails(courseId);
  if (!course) {
    throw data("Course not found.", { status: 404 });
  }

  const lessonCount = getLessonCountForCourse(courseId);
  const enrollmentCount = getEnrollmentCountForCourse(courseId);

  // Student roster data
  const enrolledStudents = getCourseEnrolledStudents(courseId);

  // Gather all lessons from the course modules and find which have quizzes
  const allCourseLessons = course.modules.flatMap((mod) => mod.lessons);
  const lessonQuizzes: {
    lessonId: number;
    lessonTitle: string;
    quizId: number;
    quizTitle: string;
  }[] = [];
  for (const lesson of allCourseLessons) {
    const quiz = getQuizByLessonId(lesson.id);
    if (quiz) {
      lessonQuizzes.push({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        quizId: quiz.id,
        quizTitle: quiz.title,
      });
    }
  }

  const students = enrolledStudents.map((enrollment) => {
    const studentUser = getUserById(enrollment.userId);
    const progress = calculateProgress(enrollment.userId, courseId, false);

    const quizScores = lessonQuizzes.map((lq) => {
      const bestAttempt = getBestAttempt(enrollment.userId, lq.quizId);
      return {
        quizId: lq.quizId,
        quizTitle: lq.quizTitle,
        lessonTitle: lq.lessonTitle,
        bestScore: bestAttempt?.score ?? null,
        passed: bestAttempt?.passed ?? null,
      };
    });

    return {
      userId: enrollment.userId,
      name: studentUser?.name ?? "Unknown",
      email: studentUser?.email ?? "",
      enrolledAt: enrollment.enrolledAt,
      completedAt: enrollment.completedAt,
      progress,
      quizScores,
    };
  });

  const quizCount = lessonQuizzes.length;

  return { course, lessonCount, enrollmentCount, students, quizCount };
}

export async function action({ params, request }: Route.ActionArgs) {
  const { course } = await coursePermissions.requireCapability(
    request,
    "manage",
    { courseId: params.courseId }
  );
  const courseId = course.id;

  const formData = await request.formData();
  const parsed = parseFormData(formData, courseEditorActionSchema);

  if (!parsed.success) {
    return data(
      { error: Object.values(parsed.errors)[0] ?? "Invalid input." },
      { status: 400 }
    );
  }

  const { intent } = parsed.data;

  if (intent === "update-title") {
    updateCourse(courseId, parsed.data.title, course.description);
    return { success: true, field: "title" };
  }

  if (intent === "update-description") {
    updateCourse(courseId, course.title, parsed.data.description);
    return { success: true, field: "description" };
  }

  if (intent === "update-status") {
    updateCourseStatus(courseId, parsed.data.status);
    return { success: true, field: "status" };
  }

  if (intent === "update-price") {
    const priceDollars = parseFloat(parsed.data.price);
    if (isNaN(priceDollars) || priceDollars < 0) {
      return data(
        { error: "Price must be a non-negative number." },
        { status: 400 }
      );
    }
    if (priceDollars > 9999.99) {
      return data({ error: "Price cannot exceed $9,999.99." }, { status: 400 });
    }
    const priceCents = Math.round(priceDollars * 100);
    updateCoursePrice(courseId, priceCents);
    return { success: true, field: "price" };
  }

  if (intent === "update-ppp-enabled") {
    const pppEnabled = parsed.data.pppEnabled === "true";
    updateCoursePppEnabled(courseId, pppEnabled);
    return { success: true, field: "ppp-enabled" };
  }

  if (intent === "add-module") {
    createModule(courseId, parsed.data.title, null);
    return { success: true, field: "module" };
  }

  if (intent === "rename-module") {
    const { moduleId, title } = parsed.data;
    const mod = getModuleById(moduleId);
    if (!mod || mod.courseId !== courseId) {
      return data(
        { error: "Module not found in this course." },
        { status: 404 }
      );
    }
    updateModuleTitle(moduleId, title);
    return { success: true, field: "module" };
  }

  if (intent === "delete-module") {
    const { moduleId } = parsed.data;
    const mod = getModuleById(moduleId);
    if (!mod || mod.courseId !== courseId) {
      return data(
        { error: "Module not found in this course." },
        { status: 404 }
      );
    }
    deleteModule(moduleId);
    return { success: true, field: "module" };
  }

  if (intent === "add-lesson") {
    const { moduleId, title } = parsed.data;
    const mod = getModuleById(moduleId);
    if (!mod || mod.courseId !== courseId) {
      return data(
        { error: "Module not found in this course." },
        { status: 404 }
      );
    }
    createLesson(moduleId, title, null, null, null, null);
    return { success: true, field: "lesson" };
  }

  if (intent === "rename-lesson") {
    const { lessonId, title } = parsed.data;
    const lesson = getLessonById(lessonId);
    if (!lesson) {
      return data({ error: "Lesson not found." }, { status: 404 });
    }
    const mod = getModuleById(lesson.moduleId);
    if (!mod || mod.courseId !== courseId) {
      return data(
        { error: "Lesson not found in this course." },
        { status: 404 }
      );
    }
    updateLessonTitle(lessonId, title);
    return { success: true, field: "lesson" };
  }

  if (intent === "reorder-modules") {
    const moduleIds: number[] = JSON.parse(parsed.data.moduleIds);
    reorderModules(courseId, moduleIds);
    return { success: true, field: "module-reorder" };
  }

  if (intent === "reorder-lessons") {
    const { moduleId, lessonIds: lessonIdsJson } = parsed.data;
    const mod = getModuleById(moduleId);
    if (!mod || mod.courseId !== courseId) {
      return data(
        { error: "Module not found in this course." },
        { status: 404 }
      );
    }
    const lessonIds: number[] = JSON.parse(lessonIdsJson);
    reorderLessons(moduleId, lessonIds);
    return { success: true, field: "lesson-reorder" };
  }

  if (intent === "move-lesson") {
    const { lessonId, targetModuleId, targetPosition } = parsed.data;
    const lesson = getLessonById(lessonId);
    if (!lesson) {
      return data({ error: "Lesson not found." }, { status: 404 });
    }
    const sourceMod = getModuleById(lesson.moduleId);
    if (!sourceMod || sourceMod.courseId !== courseId) {
      return data(
        { error: "Lesson not found in this course." },
        { status: 404 }
      );
    }
    const targetMod = getModuleById(targetModuleId);
    if (!targetMod || targetMod.courseId !== courseId) {
      return data(
        { error: "Target module not found in this course." },
        { status: 404 }
      );
    }
    moveLessonToModule(lessonId, targetModuleId, targetPosition);
    return { success: true, field: "lesson-move" };
  }

  if (intent === "delete-lesson") {
    const { lessonId } = parsed.data;
    const lesson = getLessonById(lessonId);
    if (!lesson) {
      return data({ error: "Lesson not found." }, { status: 404 });
    }
    const mod = getModuleById(lesson.moduleId);
    if (!mod || mod.courseId !== courseId) {
      return data(
        { error: "Lesson not found in this course." },
        { status: 404 }
      );
    }
    deleteLesson(lessonId);
    return { success: true, field: "lesson" };
  }

  if (intent === "update-sales-copy") {
    updateCourseSalesCopy(courseId, parsed.data.salesCopy);
    return { success: true, field: "sales-copy" };
  }

  throw data("Invalid action.", { status: 400 });
}

export default function InstructorCourseEditor({
  loaderData,
}: Route.ComponentProps) {
  const { course, lessonCount, enrollmentCount, students, quizCount } =
    loaderData;
  const statusFetcher = useFetcher();
  const reorderFetcher = useFetcher();
  const lessonReorderFetcher = useFetcher();
  const salesCopyFetcher = useFetcher();
  const priceFetcher = useFetcher();
  const pppFetcher = useFetcher();

  const [salesCopy, setSalesCopy] = useState<string>(course.salesCopy);
  const salesCopyHasChanges = salesCopy !== course.salesCopy;
  const salesCopyIsEmpty = salesCopy.trim().length === 0;

  useEffect(() => {
    if (statusFetcher.state === "idle" && statusFetcher.data?.success) {
      toast.success("Course status updated.");
    }
    if (statusFetcher.state === "idle" && statusFetcher.data?.error) {
      toast.error(statusFetcher.data.error);
    }
  }, [statusFetcher.state, statusFetcher.data]);

  useEffect(() => {
    if (reorderFetcher.state === "idle" && reorderFetcher.data?.success) {
      toast.success("Modules reordered.");
    }
    if (reorderFetcher.state === "idle" && reorderFetcher.data?.error) {
      toast.error(reorderFetcher.data.error);
    }
  }, [reorderFetcher.state, reorderFetcher.data]);

  useEffect(() => {
    if (
      lessonReorderFetcher.state === "idle" &&
      lessonReorderFetcher.data?.success
    ) {
      toast.success("Lessons reordered.");
    }
    if (
      lessonReorderFetcher.state === "idle" &&
      lessonReorderFetcher.data?.error
    ) {
      toast.error(lessonReorderFetcher.data.error);
    }
  }, [lessonReorderFetcher.state, lessonReorderFetcher.data]);

  useEffect(() => {
    if (salesCopyFetcher.state === "idle" && salesCopyFetcher.data?.success) {
      toast.success("Sales copy saved.");
    }
    if (salesCopyFetcher.state === "idle" && salesCopyFetcher.data?.error) {
      toast.error(salesCopyFetcher.data.error);
    }
  }, [salesCopyFetcher.state, salesCopyFetcher.data]);

  useEffect(() => {
    if (priceFetcher.state === "idle" && priceFetcher.data?.success) {
      toast.success("Price updated.");
    }
    if (priceFetcher.state === "idle" && priceFetcher.data?.error) {
      toast.error(priceFetcher.data.error);
    }
  }, [priceFetcher.state, priceFetcher.data]);

  useEffect(() => {
    if (pppFetcher.state === "idle" && pppFetcher.data?.success) {
      toast.success("PPP setting updated.");
    }
    if (pppFetcher.state === "idle" && pppFetcher.data?.error) {
      toast.error(pppFetcher.data.error);
    }
  }, [pppFetcher.state, pppFetcher.data]);

  function handleSalesCopySave() {
    salesCopyFetcher.submit(
      { intent: "update-sales-copy", salesCopy },
      { method: "post" }
    );
  }

  function handleStatusChange(newStatus: string) {
    statusFetcher.submit(
      { intent: "update-status", status: newStatus },
      { method: "post" }
    );
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    if (
      result.source.droppableId === result.destination.droppableId &&
      result.source.index === result.destination.index
    ) {
      return;
    }

    if (result.type === "module") {
      const reordered = Array.from(course.modules);
      const [moved] = reordered.splice(result.source.index, 1);
      reordered.splice(result.destination.index, 0, moved);

      const moduleIds = reordered.map((m) => m.id);
      reorderFetcher.submit(
        { intent: "reorder-modules", moduleIds: JSON.stringify(moduleIds) },
        { method: "post" }
      );
    } else if (result.type === "lesson") {
      const sourceModuleId = parseInt(
        result.source.droppableId.replace("lessons-", ""),
        10
      );
      const destModuleId = parseInt(
        result.destination.droppableId.replace("lessons-", ""),
        10
      );

      if (sourceModuleId === destModuleId) {
        // Reorder within the same module
        const mod = course.modules.find((m) => m.id === sourceModuleId);
        if (!mod) return;

        const reordered = Array.from(mod.lessons);
        const [moved] = reordered.splice(result.source.index, 1);
        reordered.splice(result.destination.index, 0, moved);

        const lessonIds = reordered.map((l) => l.id);
        lessonReorderFetcher.submit(
          {
            intent: "reorder-lessons",
            moduleId: String(sourceModuleId),
            lessonIds: JSON.stringify(lessonIds),
          },
          { method: "post" }
        );
      } else {
        // Move lesson to a different module
        const sourceMod = course.modules.find((m) => m.id === sourceModuleId);
        if (!sourceMod) return;

        const lesson = sourceMod.lessons[result.source.index];
        if (!lesson) return;

        // Target position is 1-based (destination index + 1)
        const targetPosition = result.destination.index + 1;

        lessonReorderFetcher.submit(
          {
            intent: "move-lesson",
            lessonId: String(lesson.id),
            targetModuleId: String(destModuleId),
            targetPosition: String(targetPosition),
          },
          { method: "post" }
        );
      }
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <CourseEditorBreadcrumb title={course.title} />

      {/* Course Header with inline editing */}
      <CourseEditorHeader
        course={course}
        lessonCount={lessonCount}
        enrollmentCount={enrollmentCount}
      />

      {/* Tabs */}
      <Tabs defaultValue="content">
        <CourseEditorTabsList />

        {/* Content Tab */}
        <TabsContent value="content" className="mt-6">
          <ModuleList course={course} handleDragEnd={handleDragEnd} />
          <AddModuleForm />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-6">
          <SettingsTab
            course={course}
            handleStatusChange={handleStatusChange}
            priceFetcher={priceFetcher}
            pppFetcher={pppFetcher}
          />
        </TabsContent>

        {/* Sales Copy Tab */}
        <TabsContent value="sales-copy" className="mt-6">
          <SalesCopyTab
            salesCopy={salesCopy}
            setSalesCopy={setSalesCopy}
            salesCopyHasChanges={salesCopyHasChanges}
            salesCopyIsEmpty={salesCopyIsEmpty}
            handleSalesCopySave={handleSalesCopySave}
            salesCopyFetcher={salesCopyFetcher}
          />
        </TabsContent>

        {/* Students Tab */}
        <TabsContent value="students" className="mt-6">
          <StudentsTab students={students} quizCount={quizCount} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading the course editor.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Course not found";
      message =
        "The course you're looking for doesn't exist or may have been removed.";
    } else if (error.status === 401) {
      title = "Sign in required";
      message =
        typeof error.data === "string"
          ? error.data
          : "Please select a user from the DevUI panel.";
    } else if (error.status === 403) {
      title = "Not allowed";
      message =
        typeof error.data === "string"
          ? error.data
          : "You don't have permission to edit this course.";
    } else {
      title = `Error ${error.status}`;
      message = typeof error.data === "string" ? error.data : error.statusText;
    }
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/instructor">
            <Button variant="outline">My Courses</Button>
          </Link>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
