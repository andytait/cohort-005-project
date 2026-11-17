import { useEffect } from "react";
import { Link, useFetcher, useNavigate } from "react-router";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { LessonProgressStatus } from "~/db/schema";
import { QuizSection } from "./quiz-section";
import type { FullLessonData, LessonCourse, NavLesson } from "./types";

export function LessonQuizBlock({ data }: { data: FullLessonData }) {
  const { lesson, enrolled, currentUserId, quiz, bestAttempt } = data;
  const quizFetcher = useFetcher({ key: `quiz-${lesson.id}` });

  const quizResult = quizFetcher.data?.quizResult ?? null;
  const isSubmittingQuiz = quizFetcher.state !== "idle";

  return (
    <>
      {quiz && enrolled && currentUserId && (
        <QuizSection
          quiz={quiz}
          bestAttempt={bestAttempt}
          quizResult={quizResult}
          quizFetcher={quizFetcher}
          isSubmitting={isSubmittingQuiz}
        />
      )}
    </>
  );
}

export function LessonCompletion({ data }: { data: FullLessonData }) {
  const { course, lesson, lessonStatus, enrolled, currentUserId, nextLesson } =
    data;
  const fetcher = useFetcher({ key: `mark-complete-${lesson.id}` });
  const navigate = useNavigate();

  const isMarking =
    fetcher.state !== "idle" &&
    fetcher.formData?.get("intent") === "mark-complete";

  const justCompleted = fetcher.data?.success;

  const isCompleted =
    lessonStatus === LessonProgressStatus.Completed || justCompleted;

  // Navigate to next lesson after marking complete
  useEffect(() => {
    if (justCompleted && nextLesson) {
      navigate(`/courses/${course.slug}/lessons/${nextLesson.id}`);
    }
  }, [justCompleted, nextLesson, course.slug, navigate]);

  return (
    <>
      {enrolled && currentUserId && (
        <div className="mb-8">
          {isCompleted ? (
            <CompletedNotice course={course} nextLesson={nextLesson} />
          ) : (
            <MarkCompleteForm
              fetcher={fetcher}
              isMarking={isMarking}
              nextLesson={nextLesson}
            />
          )}
        </div>
      )}
    </>
  );
}

function CompletedNotice({
  course,
  nextLesson,
}: {
  course: LessonCourse;
  nextLesson: NavLesson;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle2 className="size-5" />
        <span className="font-medium">Lesson completed</span>
      </div>
      {nextLesson && (
        <Link to={`/courses/${course.slug}/lessons/${nextLesson.id}`}>
          <Button variant="outline" size="sm">
            Up next: {nextLesson.title}
            <ChevronRight className="ml-1 size-4" />
          </Button>
        </Link>
      )}
    </div>
  );
}

function MarkCompleteForm({
  fetcher,
  isMarking,
  nextLesson,
}: {
  fetcher: ReturnType<typeof useFetcher>;
  isMarking: boolean;
  nextLesson: NavLesson;
}) {
  return nextLesson ? (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="mark-complete" />
      <Button disabled={isMarking}>
        {isMarking ? (
          "Completing..."
        ) : (
          <>
            Up next: {nextLesson.title}
            <ChevronRight className="ml-1 size-4" />
          </>
        )}
      </Button>
    </fetcher.Form>
  ) : (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="mark-complete" />
      <Button disabled={isMarking}>
        <CheckCircle2 className="mr-2 size-4" />
        {isMarking ? "Marking..." : "Mark as Complete"}
      </Button>
    </fetcher.Form>
  );
}
