import { describe, it, expect } from "vitest";
import { editorThemeFor, editorThemes } from "../editor-theme";
import {
  editorHeightFor,
  MIN_EDITOR_HEIGHT,
  MAX_EDITOR_HEIGHT,
} from "../editor-height";
import { saveBarState } from "../save-bar";

describe("editorThemeFor", () => {
  it("gives a light editor on a light page", () => {
    const theme = editorThemeFor(false);
    expect(theme.name).toBe("cadence-light");
    expect(theme.data.base).toBe("vs");
    expect(theme.data.colors["editor.background"]).toBe("#ffffff");
  });

  it("gives a dark editor on a dark page", () => {
    const theme = editorThemeFor(true);
    expect(theme.name).toBe("cadence-dark");
    expect(theme.data.base).toBe("vs-dark");
    expect(theme.data.colors["editor.background"]).toBe("#0a0a0a");
  });

  it("registers both themes, keeping Monaco's own syntax colours", () => {
    expect(editorThemes.map((t) => t.name)).toEqual([
      "cadence-light",
      "cadence-dark",
    ]);
    for (const theme of editorThemes) {
      expect(theme.data.inherit).toBe(true);
      expect(theme.data.rules).toEqual([]);
    }
  });

  it("gives every colour a hex value Monaco can read", () => {
    for (const theme of editorThemes) {
      for (const colour of Object.values(theme.data.colors)) {
        expect(colour).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it("styles the same parts of the editor in both themes", () => {
    const [light, dark] = editorThemes.map((t) =>
      Object.keys(t.data.colors).sort()
    );
    expect(light).toEqual(dark);
    expect(light).toHaveLength(12);
  });
});

describe("editorHeightFor", () => {
  it("never shrinks below the minimum for a short lesson", () => {
    expect(editorHeightFor(0)).toBe(MIN_EDITOR_HEIGHT);
    expect(editorHeightFor(MIN_EDITOR_HEIGHT - 1)).toBe(MIN_EDITOR_HEIGHT);
  });

  it("follows the content in between", () => {
    expect(editorHeightFor(400)).toBe(400);
    expect(editorHeightFor(400.2)).toBe(401);
  });

  it("stops at the maximum for a long lesson", () => {
    expect(editorHeightFor(MAX_EDITOR_HEIGHT + 1)).toBe(MAX_EDITOR_HEIGHT);
    expect(editorHeightFor(5000)).toBe(MAX_EDITOR_HEIGHT);
  });

  it("uses 240 and 640 as the bounds", () => {
    expect(MIN_EDITOR_HEIGHT).toBe(240);
    expect(MAX_EDITOR_HEIGHT).toBe(640);
  });
});

describe("saveBarState", () => {
  it("is disabled and says so when nothing has changed", () => {
    expect(saveBarState({ hasChanges: false, saving: false })).toEqual({
      label: "Save Changes",
      status: "All changes saved.",
      disabled: true,
    });
  });

  it("is enabled when there are unsaved changes", () => {
    expect(saveBarState({ hasChanges: true, saving: false })).toEqual({
      label: "Save Changes",
      status: "You have unsaved changes.",
      disabled: false,
    });
  });

  it("is disabled while a save is in flight", () => {
    expect(saveBarState({ hasChanges: true, saving: true })).toEqual({
      label: "Saving...",
      status: "Saving your changes.",
      disabled: true,
    });
  });
});
