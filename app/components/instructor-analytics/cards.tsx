import { formatMoney } from "~/lib/analytics";
import type { CourseProgressSummary } from "~/modules/instructor-analytics/index.server";
import { Card, CardContent } from "~/components/ui/card";

export function MoneyCard({
  label,
  amountCents,
  hint,
  emphasis,
}: {
  label: string;
  amountCents: number;
  hint: string;
  emphasis?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-sm font-medium text-muted-foreground">{label}</div>
        <div
          className={
            emphasis
              ? "mt-2 text-3xl font-bold text-primary"
              : "mt-2 text-3xl font-bold"
          }
        >
          {formatMoney(amountCents)}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

/**
 * A single figure with its own empty copy.
 *
 * Every panel says what it means when it has nothing, so an instructor can
 * tell "nothing has happened yet" from "this is broken".
 */
export function StatCard({
  label,
  value,
  hint,
  emptyHint,
  action,
}: {
  label: string;
  value: string | number;
  hint: string;
  /** Shown instead of `hint` when the figure is zero — and greys the figure. */
  emptyHint?: string;
  action?: React.ReactNode;
}) {
  const empty = emptyHint !== undefined && (value === 0 || value === "–");

  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-sm font-medium text-muted-foreground">{label}</div>
        <div
          className={
            empty
              ? "mt-2 text-3xl font-bold text-muted-foreground"
              : "mt-2 text-3xl font-bold"
          }
        >
          {value}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {empty ? emptyHint : hint}
        </p>
        {action}
      </CardContent>
    </Card>
  );
}

/** The two completion figures, side by side and deliberately not merged. */
export function CourseProgress({
  progress,
}: {
  progress: CourseProgressSummary;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardContent className="p-6">
          <div className="text-sm font-medium text-muted-foreground">
            Average progress <span className="font-normal">· all time</span>
          </div>
          <div className="mt-2 text-3xl font-bold">
            {progress.averageProgressPercent === null
              ? "–"
              : `${progress.averageProgressPercent}%`}
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${progress.averageProgressPercent ?? 0}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Lessons completed per enrolled student, across{" "}
            {progress.enrolledCount}{" "}
            {progress.enrolledCount === 1 ? "student" : "students"} and{" "}
            {progress.totalLessons}{" "}
            {progress.totalLessons === 1 ? "lesson" : "lessons"}.
          </p>
        </CardContent>
      </Card>

      <FinishedStudentsCard progress={progress} />
    </div>
  );
}

function FinishedStudentsCard({
  progress,
}: {
  progress: CourseProgressSummary;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-sm font-medium text-muted-foreground">
          Students finished <span className="font-normal">· all time</span>
        </div>
        <div className="mt-2 text-3xl font-bold">{progress.finishedCount}</div>
        {/* A count, and deliberately not a third percentage: several
              defensible completion rates exist, they disagree, and naming one
              of them here would be wrong for whoever is reading. */}
        <p className="mt-2 text-xs text-muted-foreground">
          Students who have completed every lesson, of {progress.enrolledCount}{" "}
          enrolled.
        </p>
      </CardContent>
    </Card>
  );
}
