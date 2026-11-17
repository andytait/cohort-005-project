import { describeNoteStatus as describe } from "./lib/note-status";
import type { NoteStatus, NoteStatusInput } from "./lib/note-status";

export type { NoteStatus, NoteStatusInput, SavedNote } from "./lib/note-status";

/**
 * What the footer of a Student's Note says, and whether Save is allowed.
 * Pass `now` so the "Saved 3m ago" text can be tested at a fixed moment.
 */
export function describeNoteStatus(input: NoteStatusInput): NoteStatus {
  return describe(input);
}
