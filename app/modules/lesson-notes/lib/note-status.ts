import { MAX_NOTE_LENGTH } from "~/lib/notes";
import { formatRelativeTime } from "~/lib/utils";

export type SavedNote = { body: string; updatedAt: string } | null;

export type NoteStatusInput = {
  saved: SavedNote;
  draft: string;
  isSaving: boolean;
  error?: string;
  now: number;
};

export type NoteStatus = {
  text: string;
  tone: "muted" | "error";
  canSave: boolean;
};

export function describeNoteStatus({
  saved,
  draft,
  isSaving,
  error,
  now,
}: NoteStatusInput): NoteStatus {
  const savedBody = saved?.body ?? "";
  const changed = draft !== savedBody;
  const tooLong = draft.trim().length > MAX_NOTE_LENGTH;
  const canSave = !isSaving && changed && draft.trim() !== "" && !tooLong;

  if (isSaving) return { text: "Saving…", tone: "muted", canSave };
  if (tooLong) {
    return {
      text: `${draft.trim().length.toLocaleString("en")} / ${MAX_NOTE_LENGTH.toLocaleString("en")} characters`,
      tone: "error",
      canSave,
    };
  }
  if (error && changed) return { text: error, tone: "error", canSave };
  if (changed) return { text: "Unsaved changes", tone: "muted", canSave };
  if (saved) {
    return {
      text: `Saved ${formatRelativeTime(saved.updatedAt, now)}`,
      tone: "muted",
      canSave,
    };
  }
  return { text: "Only you can see your notes.", tone: "muted", canSave };
}
