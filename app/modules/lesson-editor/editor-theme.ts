import type * as Monaco from "monaco-editor";

export type EditorTheme = {
  name: string;
  data: Monaco.editor.IStandaloneThemeData;
};

// Colours mirror the app's neutral palette (app/app.css). The editor background
// is the --card colour of each theme, so the editor reads as part of the card
// it sits in rather than a black box dropped on the page.
const light: EditorTheme = {
  name: "cadence-light",
  data: {
    base: "vs",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#171717",
      "editorLineNumber.foreground": "#a3a3a3",
      "editorLineNumber.activeForeground": "#525252",
      "editor.selectionBackground": "#e5e5e5",
      "editor.lineHighlightBackground": "#fafafa",
      "editorCursor.foreground": "#171717",
      "editorWidget.background": "#ffffff",
      "editorWidget.border": "#e5e5e5",
      "input.background": "#ffffff",
      "input.border": "#e5e5e5",
      focusBorder: "#a3a3a3",
    },
  },
};

const dark: EditorTheme = {
  name: "cadence-dark",
  data: {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#171717",
      "editor.foreground": "#e5e5e5",
      "editorLineNumber.foreground": "#525252",
      "editorLineNumber.activeForeground": "#a3a3a3",
      "editor.selectionBackground": "#404040",
      "editor.lineHighlightBackground": "#262626",
      "editorCursor.foreground": "#e5e5e5",
      "editorWidget.background": "#262626",
      "editorWidget.border": "#404040",
      "input.background": "#262626",
      "input.border": "#404040",
      focusBorder: "#525252",
    },
  },
};

export const editorThemes: readonly EditorTheme[] = [light, dark];

export function editorThemeFor(isDark: boolean): EditorTheme {
  return isDark ? dark : light;
}
