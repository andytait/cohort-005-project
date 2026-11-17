import { Link } from "react-router";
import { ArrowLeft, BookOpen, FileText, Settings, Users } from "lucide-react";
import { TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  InlineEditableDescription,
  InlineEditableTitle,
} from "./inline-editable-course-fields";
import type { EditorCourse } from "./types";

export function CourseEditorBreadcrumb({ title }: { title: string }) {
  return (
    <>
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/instructor" className="hover:text-foreground">
          My Courses
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{title}</span>
      </nav>

      <Link
        to="/instructor"
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 size-4" />
        Back to My Courses
      </Link>
    </>
  );
}

export function CourseEditorHeader({
  course,
  lessonCount,
  enrollmentCount,
}: {
  course: EditorCourse;
  lessonCount: number;
  enrollmentCount: number;
}) {
  return (
    <div className="mb-8">
      <InlineEditableTitle value={course.title} courseId={course.id} />
      <div className="mt-2">
        <InlineEditableDescription
          value={course.description}
          courseId={course.id}
        />
      </div>

      {/* Stats row */}
      <div className="mt-4 flex flex-wrap items-center gap-4 px-3 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <BookOpen className="size-4" />
          {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="size-4" />
          {enrollmentCount} {enrollmentCount === 1 ? "student" : "students"}
        </span>
        <span className="text-xs text-muted-foreground">
          Slug: /courses/{course.slug}
        </span>
      </div>
    </div>
  );
}

export function CourseEditorTabsList() {
  return (
    <TabsList>
      <TabsTrigger value="content">
        <BookOpen className="size-4" />
        Content
      </TabsTrigger>
      <TabsTrigger value="settings">
        <Settings className="size-4" />
        Settings
      </TabsTrigger>
      <TabsTrigger value="sales-copy">
        <FileText className="size-4" />
        Sales Copy
      </TabsTrigger>
      <TabsTrigger value="students">
        <Users className="size-4" />
        Students
      </TabsTrigger>
    </TabsList>
  );
}
