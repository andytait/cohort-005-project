import {
  useRef,
  useCallback,
  useState,
  useEffect,
  type ComponentType,
} from "react";
import type { EditorProps, OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import {
  editorThemeFor,
  editorThemes,
} from "~/modules/lesson-editor/editor-theme";
import {
  editorHeightFor,
  MIN_EDITOR_HEIGHT,
} from "~/modules/lesson-editor/editor-height";

function isDarkPage() {
  return document.documentElement.classList.contains("dark");
}

type MonacoMarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
};

export function MonacoMarkdownEditor({
  value,
  onChange,
  onSave,
}: MonacoMarkdownEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;

  const [Editor, setEditor] = useState<ComponentType<EditorProps> | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const [height, setHeight] = useState(MIN_EDITOR_HEIGHT);

  // The sidebar toggles dark mode by flipping a class on <html>; follow it so
  // the editor never stays dark on a light page or the other way round.
  useEffect(() => {
    const observer = new MutationObserver(() => {
      monacoRef.current?.editor.setTheme(editorThemeFor(isDarkPage()).name);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    import("@monaco-editor/react").then((mod) => {
      setEditor(() => mod.default);
    });
  }, []);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    for (const theme of editorThemes) {
      monaco.editor.defineTheme(theme.name, theme.data);
    }
    monaco.editor.setTheme(editorThemeFor(isDarkPage()).name);

    setHeight(editorHeightFor(editor.getContentHeight()));
    editor.onDidContentSizeChange(({ contentHeight }) => {
      setHeight(editorHeightFor(contentHeight));
    });

    // Register Prettier as Monaco's native document formatter for Markdown
    monaco.languages.registerDocumentFormattingEditProvider("markdown", {
      provideDocumentFormattingEdits: async (
        model: Monaco.editor.ITextModel
      ) => {
        try {
          const [prettier, markdownPlugin] = await Promise.all([
            import("prettier/standalone"),
            import("prettier/plugins/markdown"),
          ]);
          const formatted = await prettier.format(model.getValue(), {
            parser: "markdown",
            plugins: [markdownPlugin.default],
            proseWrap: "preserve",
            tabWidth: 2,
          });
          return [
            {
              text: formatted,
              range: model.getFullModelRange(),
            },
          ];
        } catch {
          return [];
        }
      },
    });

    // Ctrl+S / Cmd+S to format with Prettier then save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
      const formatAction = editor.getAction("editor.action.formatDocument");
      if (formatAction) {
        await formatAction.run();
        onChangeRef.current(editor.getValue());
      }
      onSaveRef.current?.();
    });
  }, []);

  if (!Editor) {
    return (
      <div
        className="overflow-hidden rounded-md border border-input"
        style={{ height: MIN_EDITOR_HEIGHT }}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-input bg-card">
      <Editor
        height={height}
        defaultLanguage="markdown"
        defaultValue={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          wordWrap: "on",
          lineNumbers: "on",
          lineNumbersMinChars: 3,
          scrollBeyondLastLine: false,
          fontSize: 14,
          fontFamily: "ui-monospace, monospace",
          padding: { top: 16, bottom: 16 },
          renderLineHighlight: "line",
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
          contextmenu: false,
        }}
      />
    </div>
  );
}
