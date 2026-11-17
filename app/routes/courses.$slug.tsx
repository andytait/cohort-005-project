import { useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import type { Route } from "./+types/courses.$slug";
import { coursePermissions } from "~/modules/permissions/course-permissions.server";
import { db } from "~/db";
import {
  courses,
  categories,
  users,
  modules,
  lessons,
  lessonProgress,
  LessonProgressStatus,
} from "~/db/schema";
import { eq, and, or, sql } from "drizzle-orm";
import { getRefundOffer, type RefundOffer } from "~/lib/refunds.server";
import {
  findRating,
  getCourseLessonIds,
  getCourseRatingSummary,
  getLessonCountForCourse,
  getLessonProgressForCourse,
  getNextIncompleteLesson,
  rateCourse,
} from "~/lib/course-detail.server";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { AlertTriangle, Pencil, PlayCircle, Users } from "lucide-react";
import { data, isRouteErrorResponse } from "react-router";
import { renderMarkdown } from "~/lib/markdown.server";
import { resolveCountry } from "~/lib/country.server";
import { calculatePppPrice, getCountryTierInfo } from "~/lib/ppp";
import { parseFormData } from "~/lib/validation";
import { MAX_RATING, MIN_RATING } from "~/lib/ratings";
import { CourseContent } from "~/components/course-detail/course-content";
import { CourseHero } from "~/components/course-detail/course-hero";
import {
  CountryLockNotice,
  CourseSidebarStats,
} from "~/components/course-detail/course-sidebar";
import { EnrollOptions } from "~/components/course-detail/enroll-options";
import { RateCourse } from "~/components/course-detail/rate-course";
import { RequestRefund } from "~/components/course-detail/request-refund";

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

function calculateProgress(
  userId: number,
  courseId: number,
  weightByDuration: boolean
) {
  const lessonIds = getCourseLessonIds(courseId);

  if (lessonIds.length === 0) return 0;

  if (weightByDuration) {
    const courseLessons = db
      .select({
        id: lessons.id,
        durationMinutes: lessons.durationMinutes,
      })
      .from(lessons)
      .where(or(...lessonIds.map((id) => eq(lessons.id, id))))
      .all();

    const totalDuration = courseLessons.reduce(
      (sum, l) => sum + (l.durationMinutes ?? 1),
      0
    );

    if (totalDuration === 0) return 0;

    const completed = db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, userId),
          eq(lessonProgress.status, LessonProgressStatus.Completed),
          or(...lessonIds.map((id) => eq(lessonProgress.lessonId, id)))
        )
      )
      .all();

    const completedIds = new Set(completed.map((p) => p.lessonId));

    const completedDuration = courseLessons
      .filter((l) => completedIds.has(l.id))
      .reduce((sum, l) => sum + (l.durationMinutes ?? 1), 0);

    return Math.round((completedDuration / totalDuration) * 100);
  }

  const completedCount = db
    .select({ count: sql<number>`count(*)` })
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.status, LessonProgressStatus.Completed),
        or(...lessonIds.map((id) => eq(lessonProgress.lessonId, id)))
      )
    )
    .get();

  return Math.round(((completedCount?.count ?? 0) / lessonIds.length) * 100);
}

const ratingSchema = z.object({
  rating: z.coerce.number().int().min(MIN_RATING).max(MAX_RATING),
});

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData?.course?.title ?? "Course";
  return [
    { title: `${title} | Cadence` },
    { name: "description", content: loaderData?.course?.description ?? "" },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  // Public page: signed-out visitors and people without an Enrollment still
  // see it.
  const decisions = await coursePermissions.getCourseDecisions(request, {
    slug: params.slug,
  });
  if (!decisions.found) {
    throw data("Course not found", { status: 404 });
  }
  const { course, person, enrolled, view, take } = decisions;
  const currentUserId = person?.id ?? null;
  const canView = view.allowed;
  const canTake = take.allowed;
  const countryLock =
    !take.allowed && take.reason.kind === "country-lock" ? take.reason : null;

  const courseWithDetails = getCourseWithDetails(course.id);
  if (!courseWithDetails) {
    throw data("Course not found", { status: 404 });
  }

  const lessonCount = getLessonCountForCourse(course.id);

  let progress = 0;
  const lessonProgressMap: Record<number, string> = {};
  let nextLessonId: number | null = null;
  let refundOffer: RefundOffer | null = null;

  if (person && enrolled) {
    refundOffer = getRefundOffer(db, person.id, course.id, new Date());
  }

  // Progress is shown only to someone who can take the course.
  if (person && canTake) {
    progress = calculateProgress(person.id, course.id, false);

    const progressRecords = getLessonProgressForCourse(person.id, course.id);
    for (const record of progressRecords) {
      lessonProgressMap[record.lessonId] = record.status;
    }

    const nextLesson = getNextIncompleteLesson(person.id, course.id);
    nextLessonId = nextLesson?.id ?? null;
  }

  // Render sales copy from Markdown to HTML server-side
  const salesCopyHtml = await renderMarkdown(courseWithDetails.salesCopy);

  const ratingSummary = getCourseRatingSummary(course.id);
  const userRating = currentUserId
    ? (findRating(currentUserId, course.id)?.rating ?? null)
    : null;

  const country = await resolveCountry(request);
  const pppPrice = courseWithDetails.pppEnabled
    ? calculatePppPrice(courseWithDetails.price, country)
    : courseWithDetails.price;
  const tierInfo = getCountryTierInfo(country);

  return {
    course: courseWithDetails,
    salesCopyHtml,
    lessonCount,
    enrolled,
    canView,
    canTake,
    countryLock,
    progress,
    lessonProgressMap,
    nextLessonId,
    currentUserId,
    pppPrice,
    tierInfo,
    ratingSummary,
    userRating,
    refundOffer,
  };
}

// Enrollment is handled via the purchase confirmation page — this action only
// records star ratings.
export async function action({ params, request }: Route.ActionArgs) {
  // Rating needs "take", so a Student under Country Lock can't rate.
  const { person, course } = await coursePermissions.requireCapability(
    request,
    "take",
    { slug: params.slug }
  );

  const formData = await request.formData();
  const parsed = parseFormData(formData, ratingSchema);

  if (!parsed.success) {
    return { ok: false as const, error: "Please choose a rating from 1 to 5." };
  }

  rateCourse(person.id, course.id, parsed.data.rating);

  return { ok: true as const, error: null };
}

export function HydrateFallback() {
  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <nav className="mb-6">
        <Skeleton className="h-4 w-48" />
      </nav>
      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Skeleton className="mb-6 aspect-video rounded-lg" />
          <Skeleton className="mb-2 h-4 w-20" />
          <Skeleton className="mb-3 h-9 w-3/4" />
          <Skeleton className="mb-2 h-4 w-full" />
          <Skeleton className="mb-4 h-4 w-2/3" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
      <Skeleton className="mb-4 h-8 w-40" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          // oxlint-disable-next-line react/no-array-index-key -- placeholders never reorder
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, j) => (
                  // oxlint-disable-next-line react/no-array-index-key -- placeholders never reorder
                  <Skeleton key={j} className="h-8 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function CourseDetail({ loaderData }: Route.ComponentProps) {
  const {
    course,
    salesCopyHtml,
    lessonCount,
    enrolled,
    canView,
    canTake,
    countryLock,
    progress,
    lessonProgressMap,
    nextLessonId,
    currentUserId,
    pppPrice,
    tierInfo,
    ratingSummary,
    userRating,
    refundOffer,
  } = loaderData;
  const isInstructor = currentUserId === course.instructorId;
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("already_enrolled") === "1") {
      toast.info("You're already enrolled in this course.");
      setSearchParams(
        (prev) => {
          prev.delete("already_enrolled");
          return prev;
        },
        { replace: true }
      );
    }
  }, [searchParams, setSearchParams]);

  const totalDuration = course.modules.reduce(
    (sum, mod) =>
      sum + mod.lessons.reduce((s, l) => s + (l.durationMinutes ?? 0), 0),
    0
  );

  const selfPurchaseLink = currentUserId
    ? `/courses/${course.slug}/purchase`
    : `/signup?redirectTo=${encodeURIComponent(`/courses/${course.slug}/purchase`)}`;

  const teamPurchaseLink = currentUserId
    ? `/courses/${course.slug}/purchase?mode=team`
    : `/signup?redirectTo=${encodeURIComponent(`/courses/${course.slug}/purchase?mode=team`)}`;

  const enrollButton = (
    <EnrollOptions
      price={course.price}
      pppPrice={pppPrice}
      tierInfo={tierInfo}
      selfPurchaseLink={selfPurchaseLink}
      teamPurchaseLink={teamPurchaseLink}
    />
  );

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/courses" className="hover:text-foreground">
          Courses
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{course.title}</span>
      </nav>

      {/* Hero section */}
      <CourseHero
        course={course}
        currentUserId={currentUserId}
        ratingSummary={ratingSummary}
        lessonCount={lessonCount}
        totalDuration={totalDuration}
      />

      {/* Two-column: sales copy left, sidebar right */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left column: sales copy + course content */}
        <div className="lg:col-span-2">
          <div
            className="prose prose-neutral dark:prose-invert max-w-none"
            // oxlint-disable-next-line react/no-danger -- the instructor wrote this Markdown
            dangerouslySetInnerHTML={{ __html: salesCopyHtml }}
          />

          {/* Bottom CTA */}
          {!enrolled && !isInstructor && (
            <div className="mt-8 rounded-lg border bg-muted/50 p-6">
              <h3 className="mb-2 text-lg font-semibold">
                Ready to get started?
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Join this course and start learning today.
              </p>
              {enrollButton}
            </div>
          )}

          <div className="mt-8">
            <CourseContent
              course={course}
              canView={canView}
              isInstructor={isInstructor}
              lessonProgressMap={lessonProgressMap}
            />
          </div>
        </div>

        {/* Right column: progress/enrollment card */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <h2 className="text-lg font-semibold">
                {isInstructor
                  ? "Your Course"
                  : enrolled
                    ? "Your Progress"
                    : "Get Started"}
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {isInstructor ? (
                <Link to={`/instructor/${course.id}`}>
                  <Button className="w-full">
                    <Pencil className="mr-2 size-4" />
                    Manage Course
                  </Button>
                </Link>
              ) : enrolled ? (
                <>
                  {countryLock && (
                    <CountryLockNotice countryLock={countryLock} />
                  )}
                  {canTake && (
                    <>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span>{progress}% complete</span>
                      </div>
                      <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      {course.modules.length > 0 &&
                        (() => {
                          const targetLessonId =
                            nextLessonId ?? course.modules[0].lessons[0]?.id;
                          return targetLessonId ? (
                            <Link
                              to={`/courses/${course.slug}/lessons/${targetLessonId}`}
                            >
                              <Button className="w-full">
                                <PlayCircle className="mr-2 size-4" />
                                {progress > 0
                                  ? "Continue Learning"
                                  : "Start Course"}
                              </Button>
                            </Link>
                          ) : null;
                        })()}
                    </>
                  )}
                  <Link to={teamPurchaseLink}>
                    <Button variant="outline" className="w-full">
                      <Users className="mr-2 size-4" />
                      Buy More Seats
                    </Button>
                  </Link>
                  {canTake && <RateCourse userRating={userRating} />}
                  {refundOffer && (
                    <RequestRefund
                      slug={course.slug}
                      purchaseId={refundOffer.purchaseId}
                      amount={refundOffer.amount}
                    />
                  )}
                </>
              ) : (
                enrollButton
              )}
              <CourseSidebarStats
                course={course}
                lessonCount={lessonCount}
                totalDuration={totalDuration}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading this course.";

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
          <Link to="/courses">
            <Button variant="outline">Browse Courses</Button>
          </Link>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
