import { Link } from "react-router";
import type {
  DraggableProvided,
  DraggableStateSnapshot,
} from "@hello-pangea/dnd";
import { Clock, Eye, FileEdit, GripVertical } from "lucide-react";
import { formatDuration } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { InlineEditableLessonTitle } from "./inline-editable-outline-titles";
import { DeleteLessonButton } from "./delete-buttons";
import type { EditorCourse, EditorLesson } from "./types";

type LessonProps = {
  course: EditorCourse;
  lesson: EditorLesson;
};

function LessonRowActions({ course, lesson }: LessonProps) {
  return (
    <>
      <Link
        to={`/courses/${course.slug}/lessons/${lesson.id}`}
        title="View lesson"
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
        >
          <Eye className="size-3.5" />
        </Button>
      </Link>
      <Link
        to={`/instructor/${course.id}/lessons/${lesson.id}`}
        title="Edit lesson"
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
        >
          <FileEdit className="size-3.5" />
        </Button>
      </Link>
      <DeleteLessonButton lessonId={lesson.id} lessonTitle={lesson.title} />
    </>
  );
}

export function LessonRow({
  lessonProvided,
  lessonSnapshot,
  course,
  lesson,
}: LessonProps & {
  lessonProvided: DraggableProvided;
  lessonSnapshot: DraggableStateSnapshot;
}) {
  return (
    <li ref={lessonProvided.innerRef} {...lessonProvided.draggableProps}>
      <div
        className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm${
          lessonSnapshot.isDragging
            ? " bg-muted shadow-md ring-1 ring-primary/30"
            : ""
        }`}
      >
        <div
          {...lessonProvided.dragHandleProps}
          className="cursor-grab active:cursor-grabbing rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <GripVertical className="size-4" />
        </div>
        <div className="flex-1">
          <InlineEditableLessonTitle
            value={lesson.title}
            lessonId={lesson.id}
          />
        </div>
        {lesson.durationMinutes && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            {formatDuration(lesson.durationMinutes, true, false, false)}
          </span>
        )}
        <LessonRowActions course={course} lesson={lesson} />
      </div>
    </li>
  );
}
