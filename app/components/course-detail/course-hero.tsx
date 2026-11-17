import { Link } from "react-router";
import { BookOpen, Clock, Pencil } from "lucide-react";
import { CourseImage } from "~/components/course-image";
import { StarRating } from "~/components/star-rating";
import { Button } from "~/components/ui/button";
import { UserAvatar } from "~/components/user-avatar";
import { formatDuration } from "~/lib/utils";

type CourseHeroCourse = {
  id: number;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  categoryName: string;
  instructorId: number;
  instructorName: string;
  instructorAvatarUrl: string | null;
};

export function CourseHero({
  course,
  currentUserId,
  ratingSummary,
  lessonCount,
  totalDuration,
}: {
  course: CourseHeroCourse;
  currentUserId: number | null;
  ratingSummary: { average: number | null; count: number };
  lessonCount: number;
  totalDuration: number;
}) {
  return (
    <div className="mb-8">
      <div className="mb-6 aspect-video max-h-64 overflow-hidden rounded-lg">
        <CourseImage
          src={course.coverImageUrl}
          alt={course.title}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="mb-2 text-sm font-medium text-primary">
        {course.categoryName}
      </div>
      <CourseHeroTitle course={course} currentUserId={currentUserId} />
      <StarRating
        average={ratingSummary.average}
        count={ratingSummary.count}
        size="md"
        className="mb-3"
      />
      <p className="mb-4 text-lg text-muted-foreground">{course.description}</p>
      <CourseHeroMeta
        course={course}
        lessonCount={lessonCount}
        totalDuration={totalDuration}
      />
    </div>
  );
}

function CourseHeroMeta({
  course,
  lessonCount,
  totalDuration,
}: {
  course: CourseHeroCourse;
  lessonCount: number;
  totalDuration: number;
}) {
  return (
    <div className="flex items-center gap-4 text-sm text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <UserAvatar
          name={course.instructorName}
          avatarUrl={course.instructorAvatarUrl}
          className="size-5"
        />
        {course.instructorName}
      </span>
      <span className="flex items-center gap-1">
        <BookOpen className="size-4" />
        {lessonCount} lessons
      </span>
      {totalDuration > 0 && (
        <span className="flex items-center gap-1">
          <Clock className="size-4" />
          {formatDuration(totalDuration, true, false, false)} total
        </span>
      )}
    </div>
  );
}

function CourseHeroTitle({
  course,
  currentUserId,
}: {
  course: CourseHeroCourse;
  currentUserId: number | null;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-4">
      <h1 className="text-4xl font-bold">{course.title}</h1>
      {currentUserId === course.instructorId && (
        <Link to={`/instructor/${course.id}`}>
          <Button variant="outline" size="sm" className="shrink-0">
            <Pencil className="mr-1.5 size-3.5" />
            Edit Course
          </Button>
        </Link>
      )}
    </div>
  );
}
