import { BookOpen, Clock, ShieldAlert } from "lucide-react";
import { UserAvatar } from "~/components/user-avatar";
import { countryName } from "~/lib/ppp";
import { formatDuration } from "~/lib/utils";

export function CountryLockNotice({
  countryLock,
}: {
  countryLock: { purchaseCountry: string; currentCountry: string };
}) {
  return (
    <div className="flex gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
      <p>
        You bought this course at a Purchasing-Power Price in{" "}
        <strong>{countryName(countryLock.purchaseCountry)}</strong>, so it
        can&apos;t be used from{" "}
        <strong>{countryName(countryLock.currentCountry)}</strong>.
      </p>
    </div>
  );
}

export function CourseSidebarStats({
  course,
  lessonCount,
  totalDuration,
}: {
  course: {
    instructorName: string;
    instructorAvatarUrl: string | null;
    instructorBio: string | null;
  };
  lessonCount: number;
  totalDuration: number;
}) {
  return (
    <div className="space-y-2 pt-2 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <BookOpen className="size-4" />
        <span>{lessonCount} lessons</span>
      </div>
      <div className="flex items-center gap-2">
        <Clock className="size-4" />
        <span>{formatDuration(totalDuration, true, false, false)} total</span>
      </div>
      <div className="flex items-center gap-2">
        <UserAvatar
          name={course.instructorName}
          avatarUrl={course.instructorAvatarUrl}
          className="size-5"
        />
        <span>Taught by {course.instructorName}</span>
      </div>
      {course.instructorBio && (
        <p className="mt-2 text-xs leading-relaxed">{course.instructorBio}</p>
      )}
    </div>
  );
}
