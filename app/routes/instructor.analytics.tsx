import { Link, isRouteErrorResponse, useSearchParams } from "react-router";
import type { Route } from "./+types/instructor.analytics";
import { people } from "~/modules/permissions/person.server";
import {
  ANALYTICS_RANGES,
  PLATFORM_FEE_PERCENT,
  formatMoney,
} from "~/lib/analytics";
import { instructorAnalytics } from "~/modules/instructor-analytics/index.server";
import { REFUND_WINDOW_DAYS } from "~/lib/refund-rules";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { AlertTriangle, Rocket } from "lucide-react";
import {
  CourseProgress,
  MoneyCard,
  StatCard,
} from "~/components/instructor-analytics/cards";
import { DropOffFunnel } from "~/components/instructor-analytics/drop-off-funnel";
import { QuizPassRates } from "~/components/instructor-analytics/quiz-pass-rates";
import { RefundExposurePanel } from "~/components/instructor-analytics/refund-exposure-panel";
import { RevenueByCountry } from "~/components/instructor-analytics/revenue-by-country";
import { RevenueChart } from "~/components/instructor-analytics/revenue-chart";
import { TopBuyers } from "~/components/instructor-analytics/top-buyers";
import { CourseRevenueTable } from "~/components/instructor-analytics/course-revenue-table";

// ─── Instructor Analytics ───
// What an instructor earned, and when. Three money figures rather than one:
// a lone number here gets read as "what I get paid", and the platform's 20%
// cut makes that reading wrong.
//
// All page state — tab, range, instructor, course — lives in search params, so
// a view can be linked to and reloaded. The loader hands them to the service
// untouched; the controls write them and let the loader re-run.
//
// Admins additionally get an instructor picker. With none picked the service
// reports platform-wide.

export function meta() {
  return [
    { title: "Analytics | Cadence" },
    { name: "description", content: "Revenue and earnings for your courses." },
  ];
}

export async function loader({ request, url }: Route.LoaderArgs) {
  const person = await people.requireInstructorOrPlatformAdmin(request);
  const viewer = {
    userId: person.id,
    isAdmin: person.role === "platform-admin",
  };
  return instructorAnalytics.get(viewer, url.searchParams, new Date());
}

export default function InstructorAnalytics({
  loaderData,
}: Route.ComponentProps) {
  const {
    tab,
    range,
    isAdmin,
    instructorId,
    selectedCourseId,
    summary,
    series,
    courses,
    courseOptions,
    progress,
    funnel,
    quizzes,
    countries,
    instructors,
    unpublished,
    audience,
    buyers,
    questions,
    ratings,
    refundExposure,
  } = loaderData;

  const [searchParams, setSearchParams] = useSearchParams();

  // Every control writes one param and leaves the rest of the view intact.
  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams);
    if (value === null) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next);
  }

  const selectedCourse =
    courseOptions.find((course) => course.courseId === selectedCourseId) ??
    null;
  // The revenue table narrows to the selected course. One with no sales in the
  // range has no row at all, and the panel says so rather than sitting empty.
  const revenueRows = selectedCourse
    ? courses.filter((course) => course.courseId === selectedCourseId)
    : courses;

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="mt-1 text-muted-foreground">
            {isAdmin && instructorId === null
              ? "Revenue across every instructor on the platform."
              : "Revenue and earnings for your courses."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <Select
              value={instructorId === null ? "all" : String(instructorId)}
              onValueChange={(value) =>
                setParam("instructor", value === "all" ? null : value)
              }
            >
              {/* SelectValue renders its selected item's text only once the
                  content has mounted, which never happens on the server — so
                  each trigger is given the label outright. */}
              <SelectTrigger aria-label="Instructor" className="w-56">
                <SelectValue>
                  {instructors.find((one) => one.id === instructorId)?.name ??
                    "All instructors"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All instructors</SelectItem>
                {instructors.map((instructor) => (
                  <SelectItem key={instructor.id} value={String(instructor.id)}>
                    {instructor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select
            value={range}
            onValueChange={(value) => setParam("range", value)}
          >
            <SelectTrigger aria-label="Date range" className="w-40">
              <SelectValue>
                {
                  ANALYTICS_RANGES.find((option) => option.value === range)
                    ?.label
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ANALYTICS_RANGES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {unpublished ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Rocket className="mx-auto mb-4 size-12 text-muted-foreground" />
            <p className="font-medium">No published courses yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Analytics start the moment you make your first sale. Publish your
              first course to get going.
            </p>
            <Link to="/instructor/new" className="mt-6 inline-block">
              <Button>Publish your first course</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={(value) => setParam("tab", value)}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="course">Course detail</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <MoneyCard
                label="Gross revenue"
                amountCents={summary.grossCents}
                hint={`What students paid, across ${summary.purchaseCount} ${
                  summary.purchaseCount === 1 ? "purchase" : "purchases"
                }.`}
              />
              <MoneyCard
                label={`Platform fee (${PLATFORM_FEE_PERCENT}%)`}
                amountCents={summary.feeCents}
                hint="Cadence's cut. Already deducted from your earnings."
              />
              <MoneyCard
                label="Your net earnings"
                amountCents={summary.netCents}
                hint="What you keep: gross revenue minus the platform fee."
                emphasis
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Buyers"
                value={audience.buyerCount}
                hint="People who paid. A team buying several seats counts once."
                emptyHint="Nobody has bought in this period."
              />
              <StatCard
                label="Enrolled students"
                value={audience.studentCount}
                hint={`Students with access, seats included.${
                  audience.revenuePerStudentCents === null
                    ? ""
                    : ` ${formatMoney(
                        audience.revenuePerStudentCents
                      )} of revenue each.`
                }`}
                emptyHint="Nobody has enrolled in this period."
              />
              <StatCard
                label="Unanswered questions"
                value={questions.inRange}
                hint={
                  questions.older > 0
                    ? `Plus ${questions.older} from before this period.`
                    : "Students waiting on a reply."
                }
                // Quiet this period is only good news if the backlog is empty
                // too, so the older count keeps its place in the empty copy.
                emptyHint={
                  questions.older > 0
                    ? `None this period, but ${questions.older} still waiting from before.`
                    : "Nothing is waiting on you."
                }
                action={
                  questions.inRange + questions.older > 0 ? (
                    <Link
                      to="/instructor/questions"
                      className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
                    >
                      Answer them
                    </Link>
                  ) : null
                }
              />
              <StatCard
                label="Course rating"
                value={ratings.average === null ? "–" : `${ratings.average} ★`}
                hint={`Across ${ratings.count} ${
                  ratings.count === 1 ? "rating" : "ratings"
                }.`}
                emptyHint="Nobody has rated your courses in this period."
              />
            </div>

            <Card>
              <CardContent className="p-6">
                <h2 className="mb-4 text-lg font-semibold">
                  Revenue over time
                </h2>
                {/* Keyed on the sales themselves, not on the points: a fixed
                    range always spans its whole window, so an instructor with
                    no sales would otherwise get a flat line along zero rather
                    than being told there is nothing there. */}
                {summary.purchaseCount === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    No sales in this period yet.
                  </p>
                ) : (
                  <RevenueChart series={series} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold">Top buyers</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  Your ten biggest spenders in this period: the people worth
                  reaching out to.
                </p>
                <TopBuyers buyers={buyers} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold">Refund exposure</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  Revenue in this period that is still inside its{" "}
                  {REFUND_WINDOW_DAYS}-day refund window, so it could still go
                  back out.
                </p>
                <RefundExposurePanel exposure={refundExposure} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="course" className="space-y-6">
            <Select
              value={selectedCourse ? String(selectedCourse.courseId) : "all"}
              onValueChange={(value) =>
                setParam("course", value === "all" ? null : value)
              }
            >
              <SelectTrigger aria-label="Course" className="w-72">
                <SelectValue>
                  {selectedCourse?.title ?? "All courses"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All courses</SelectItem>
                {courseOptions.map((course) => (
                  <SelectItem
                    key={course.courseId}
                    value={String(course.courseId)}
                  >
                    {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {progress && funnel ? (
              progress.enrolledCount === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="font-medium">Nobody is enrolled yet</p>
                    <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                      Progress and drop-off appear as soon as the first student
                      joins {selectedCourse?.title}.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <CourseProgress progress={progress} />

                  <Card>
                    <CardContent className="p-6">
                      <h2 className="text-lg font-semibold">Drop-off</h2>
                      <p className="mb-4 text-sm text-muted-foreground">
                        How many of the {funnel.enrolledCount} enrolled{" "}
                        {funnel.enrolledCount === 1 ? "student" : "students"}{" "}
                        got at least as far as each lesson, all time. The bars
                        only descend, so the biggest gap is where students quit.
                        The figure beside a lesson counts the ones who never
                        reached it, having stopped on the lesson above.
                      </p>
                      <DropOffFunnel funnel={funnel} />
                    </CardContent>
                  </Card>
                </>
              )
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="font-medium">Pick a course</p>
                  <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                    {courseOptions.length === 0
                      ? "There are no courses here to look into yet."
                      : "Choose one of your courses above to see how far students get and where they give up."}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Both panels sit outside the enrolment gate above: a quiz with
                nobody enrolled to sit it, and money arriving before anybody
                claims their seat, are things an instructor should still be
                told about rather than shown one "nobody is enrolled" card in
                place of. */}
            {quizzes && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold">Quiz results</h2>
                  <p className="mb-4 text-sm text-muted-foreground">
                    One result per student per quiz, counting their best
                    attempt, the same basis as the student roster. Retakes are
                    not counted separately, so a quiz people get on the second
                    go still reads as passed. Attempts made in this period only.
                  </p>
                  <QuizPassRates quizzes={quizzes} />
                </CardContent>
              </Card>
            )}

            {countries && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold">Revenue by country</h2>
                  <RevenueByCountry breakdown={countries} />
                </CardContent>
              </Card>
            )}

            <CourseRevenueTable revenueRows={revenueRows} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

export function HydrateFallback() {
  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <Skeleton className="mb-2 h-9 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <Skeleton className="mb-4 h-9 w-64" />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading your analytics.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 401) {
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
          : "You aren't allowed to see this page.";
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
        <Link to="/courses">
          <Button>Browse Courses</Button>
        </Link>
      </div>
    </div>
  );
}
