import { describe, expect, it } from "vitest";
import { describeNoteStatus } from "../index";
import { MAX_NOTE_LENGTH } from "~/lib/notes";

const now = Date.parse("2026-11-17T12:00:00.000Z");
const saved = {
  body: "Result types beat throws.",
  updatedAt: "2026-11-17T11:55:00.000Z",
};

describe("describeNoteStatus", () => {
  it("invites a first note when there is none", () => {
    expect(
      describeNoteStatus({ saved: null, draft: "", isSaving: false, now })
    ).toEqual({
      text: "Only you can see your notes.",
      tone: "muted",
      canSave: false,
    });
  });

  it("says when an unchanged note was saved, and does not offer Save", () => {
    expect(
      describeNoteStatus({ saved, draft: saved.body, isSaving: false, now })
    ).toEqual({ text: "Saved 5m ago", tone: "muted", canSave: false });
  });

  it("flags unsaved changes and offers Save", () => {
    expect(
      describeNoteStatus({ saved, draft: "New thought", isSaving: false, now })
    ).toEqual({ text: "Unsaved changes", tone: "muted", canSave: true });
  });

  it("offers Save for a first note", () => {
    expect(
      describeNoteStatus({ saved: null, draft: "Hi", isSaving: false, now })
        .canSave
    ).toBe(true);
  });

  it("does not offer Save for a blank draft", () => {
    expect(
      describeNoteStatus({ saved, draft: "   ", isSaving: false, now }).canSave
    ).toBe(false);
  });

  it("shows saving and blocks a second save while one is in flight", () => {
    expect(
      describeNoteStatus({ saved, draft: "New thought", isSaving: true, now })
    ).toEqual({ text: "Saving…", tone: "muted", canSave: false });
  });

  it("shows the server's error while the draft is still unsaved", () => {
    expect(
      describeNoteStatus({
        saved,
        draft: "New thought",
        isSaving: false,
        error: "Something broke.",
        now,
      })
    ).toEqual({ text: "Something broke.", tone: "error", canSave: true });
  });

  it("drops a stale error once the draft matches the saved note", () => {
    expect(
      describeNoteStatus({
        saved,
        draft: saved.body,
        isSaving: false,
        error: "Something broke.",
        now,
      }).tone
    ).toBe("muted");
  });

  it("counts trimmed characters and blocks Save when the note is too long", () => {
    expect(
      describeNoteStatus({
        saved,
        draft: `  ${"a".repeat(MAX_NOTE_LENGTH + 1)}  `,
        isSaving: false,
        now,
      })
    ).toEqual({
      text: "2,001 / 2,000 characters",
      tone: "error",
      canSave: false,
    });
  });

  it("allows a note of exactly the maximum length", () => {
    expect(
      describeNoteStatus({
        saved,
        draft: "a".repeat(MAX_NOTE_LENGTH),
        isSaving: false,
        now,
      })
    ).toEqual({ text: "Unsaved changes", tone: "muted", canSave: true });
  });

  it("ignores surrounding whitespace when measuring length", () => {
    expect(
      describeNoteStatus({
        saved,
        draft: ` ${"a".repeat(MAX_NOTE_LENGTH)} `,
        isSaving: false,
        now,
      }).canSave
    ).toBe(true);
  });
});
