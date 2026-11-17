import { Clock, Github } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { YouTubePlayer } from "~/components/youtube-player";
import { formatDuration } from "~/lib/utils";
import { CurriculumSidebar } from "./curriculum-sidebar";
import { LessonBreadcrumb } from "./lesson-breadcrumb";
import { LessonDiscussion } from "./lesson-discussion";
import { BookmarkToggle, LessonNote } from "./lesson-note";
import { LessonCompletion, LessonQuizBlock } from "./lesson-progress-controls";
import { useAutoplay } from "./use-autoplay";
import type { FullLessonData } from "./types";

export function FullLesson({ data }: { data: FullLessonData }) {
  const {
    course,
    curriculum,
    module: mod,
    lesson,
    enrolled,
    lessonProgressMap,
  } = data;

  return (
    <div className="flex">
      {/* Curriculum Sidebar */}
      <CurriculumSidebar
        course={course}
        curriculum={curriculum}
        currentLessonId={lesson.id}
        lessonProgressMap={lessonProgressMap}
        enrolled={enrolled}
      />

      <div className="flex-1 p-6 lg:p-8">
        <LessonBreadcrumb
          course={course}
          mod={mod}
          lessonTitle={lesson.title}
        />

        <div className="mx-auto max-w-4xl">
          <LessonMedia data={data} />

          {/* Quiz Section */}
          <LessonQuizBlock data={data} />

          {/* Mark Complete / Up Next */}
          <LessonCompletion data={data} />

          <LessonDiscussion data={data} />
        </div>
      </div>
    </div>
  );
}

function LessonMedia({ data }: { data: FullLessonData }) {
  const {
    lesson,
    contentHtml,
    enrolled,
    currentUserId,
    lastWatchPosition,
    watchProgress,
    bookmarked,
    note,
  } = data;
  const [autoplay, toggleAutoplay] = useAutoplay();

  return (
    <>
      {/* Lesson Title */}
      <LessonHeader
        lesson={lesson}
        currentUserId={currentUserId}
        bookmarked={bookmarked}
      />

      {/* YouTube Video */}
      {lesson.videoUrl && (
        <YouTubePlayer
          videoUrl={lesson.videoUrl}
          lessonId={lesson.id}
          title={lesson.title}
          startPosition={lastWatchPosition}
          durationMinutes={lesson.durationMinutes}
          watchProgress={watchProgress}
          trackingEnabled={enrolled && !!currentUserId}
          autoplay={autoplay}
          onToggleAutoplay={toggleAutoplay}
        />
      )}

      {/* Note — under the video, so the Student can write while they watch */}
      {currentUserId && <LessonNote note={note} />}

      {/* Lesson Content */}
      <LessonContent contentHtml={contentHtml} lesson={lesson} />
    </>
  );
}

function LessonHeader({
  lesson,
  currentUserId,
  bookmarked,
}: {
  lesson: FullLessonData["lesson"];
  currentUserId: number | null;
  bookmarked: boolean;
}) {
  return (
    <>
      <div className="mb-2 flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold">{lesson.title}</h1>
        {currentUserId && <BookmarkToggle bookmarked={bookmarked} />}
      </div>
      <div className="mb-6 flex items-center gap-3">
        {lesson.durationMinutes && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="size-4" />
            {formatDuration(lesson.durationMinutes, true, false, false)}
          </div>
        )}
        {lesson.githubRepoUrl && (
          <a
            href={lesson.githubRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <Github className="mr-1.5 size-4" />
              Open Code
            </Button>
          </a>
        )}
      </div>
    </>
  );
}

function LessonContent({
  contentHtml,
  lesson,
}: {
  contentHtml: string | null;
  lesson: FullLessonData["lesson"];
}) {
  return (
    <>
      {contentHtml && (
        <div
          className="prose prose-neutral dark:prose-invert mb-8 max-w-none"
          // oxlint-disable-next-line react/no-danger -- the instructor wrote this Markdown
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      )}

      {!contentHtml && !lesson.videoUrl && (
        <Card className="mb-8">
          <CardContent className="py-12 text-center text-muted-foreground">
            No content has been added to this lesson yet.
          </CardContent>
        </Card>
      )}
    </>
  );
}
