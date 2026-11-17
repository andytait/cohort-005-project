import {
  DragDropContext,
  Droppable,
  Draggable,
  type DraggableProvided,
  type DraggableStateSnapshot,
  type DropResult,
} from "@hello-pangea/dnd";
import { BookOpen, GripVertical } from "lucide-react";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { InlineEditableModuleTitle } from "./inline-editable-outline-titles";
import { DeleteModuleButton } from "./delete-buttons";
import { AddLessonForm } from "./add-forms";
import { LessonRow } from "./lesson-row";
import type { EditorCourse, EditorModule } from "./types";

type ModuleProps = {
  course: EditorCourse;
  mod: EditorModule;
};

function ModuleLessons({ course, mod }: ModuleProps) {
  return (
    <CardContent>
      {mod.lessons.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">
          No lessons yet.
        </p>
      ) : (
        <Droppable droppableId={`lessons-${mod.id}`} type="lesson">
          {(lessonDropProvided) => (
            <ul
              className="space-y-1"
              ref={lessonDropProvided.innerRef}
              {...lessonDropProvided.droppableProps}
            >
              {mod.lessons.map((lesson, lessonIndex) => (
                <Draggable
                  key={lesson.id}
                  draggableId={`lesson-${lesson.id}`}
                  index={lessonIndex}
                >
                  {(lessonProvided, lessonSnapshot) => (
                    <LessonRow
                      lessonProvided={lessonProvided}
                      lessonSnapshot={lessonSnapshot}
                      course={course}
                      lesson={lesson}
                    />
                  )}
                </Draggable>
              ))}
              {lessonDropProvided.placeholder}
            </ul>
          )}
        </Droppable>
      )}
      <AddLessonForm moduleId={mod.id} />
    </CardContent>
  );
}

function ModuleCard({
  provided,
  snapshot,
  course,
  mod,
}: ModuleProps & {
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
}) {
  return (
    <div ref={provided.innerRef} {...provided.draggableProps}>
      <Card
        className={
          snapshot.isDragging ? "shadow-lg ring-2 ring-primary/50" : ""
        }
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              <div
                {...provided.dragHandleProps}
                className="cursor-grab active:cursor-grabbing rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <GripVertical className="size-5" />
              </div>
              <div className="flex-1">
                <InlineEditableModuleTitle
                  value={mod.title}
                  moduleId={mod.id}
                />
                <p className="mt-1 px-2 text-sm text-muted-foreground">
                  {mod.lessons.length}{" "}
                  {mod.lessons.length === 1 ? "lesson" : "lessons"}
                </p>
              </div>
            </div>
            <DeleteModuleButton moduleId={mod.id} moduleTitle={mod.title} />
          </div>
        </CardHeader>
        <ModuleLessons course={course} mod={mod} />
      </Card>
    </div>
  );
}

export function ModuleList({
  course,
  handleDragEnd,
}: {
  course: EditorCourse;
  handleDragEnd: (result: DropResult) => void;
}) {
  return course.modules.length === 0 ? (
    <Card>
      <CardContent className="py-8 text-center">
        <BookOpen className="mx-auto mb-3 size-8 text-muted-foreground/50" />
        <p className="text-muted-foreground">
          No modules yet. Add your first module to start building content.
        </p>
      </CardContent>
    </Card>
  ) : (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="modules" type="module">
        {(provided) => (
          <div
            className="space-y-4"
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {course.modules.map((mod, index) => (
              <Draggable
                key={mod.id}
                draggableId={String(mod.id)}
                index={index}
              >
                {(provided, snapshot) => (
                  <ModuleCard
                    provided={provided}
                    snapshot={snapshot}
                    course={course}
                    mod={mod}
                  />
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
