import { useId, useState, type ReactNode } from "react";
import { useFetcher } from "react-router";
import { NotebookPen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import {
  describeNoteStatus,
  type NoteStatus,
  type SavedNote,
} from "~/modules/lesson-notes";

/**
 * The Student's private Note for a Lesson, with the Lesson's completion
 * button in the same footer, so the end of the Lesson is one place.
 */
export function LessonNotePanel({
  note,
  action,
}: {
  note: SavedNote;
  action?: ReactNode;
}) {
  const formId = useId();
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [draft, setDraft] = useState(note?.body ?? "");
  const [now] = useState(() => Date.now());
  const status = describeNoteStatus({
    saved: note,
    draft,
    isSaving: fetcher.state !== "idle",
    error: fetcher.data?.error,
    now,
  });

  return (
    <section
      aria-labelledby={`${formId}-title`}
      className="mb-8 overflow-hidden rounded-xl border bg-card shadow-xs transition-shadow focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30"
    >
      <fetcher.Form id={formId} method="post">
        <input type="hidden" name="intent" value="save-note" />
        <label
          id={`${formId}-title`}
          htmlFor={`${formId}-body`}
          className="flex items-center gap-2 px-4 pt-3 text-sm font-medium text-muted-foreground"
        >
          <NotebookPen className="size-4" />
          Your notes
        </label>
        <textarea
          id={`${formId}-body`}
          name="body"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Jot down what you want to remember from this lesson…"
          className="field-sizing-content block min-h-24 w-full resize-none bg-transparent px-4 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/70"
        />
      </fetcher.Form>

      <NoteFooter formId={formId} status={status} action={action} />
    </section>
  );
}

function NoteFooter({
  formId,
  status,
  action,
}: {
  formId: string;
  status: NoteStatus;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          type="submit"
          form={formId}
          variant="outline"
          size="sm"
          disabled={!status.canSave}
        >
          Save note
        </Button>
        <span
          suppressHydrationWarning
          role={status.tone === "error" ? "alert" : undefined}
          className={cn(
            "truncate text-xs",
            status.tone === "error"
              ? "text-destructive"
              : "text-muted-foreground"
          )}
        >
          {status.text}
        </span>
      </div>
      {action}
    </div>
  );
}
