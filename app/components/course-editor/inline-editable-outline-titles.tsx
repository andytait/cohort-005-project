import { useState, useRef, useEffect } from "react";
import { useFetcher } from "react-router";
import { Pencil } from "lucide-react";
import type { Fetcher } from "./types";

type TitleEditorProps = {
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  editValue: string;
  setEditValue: (value: string) => void;
  setIsEditing: (isEditing: boolean) => void;
  fetcher: Fetcher;
};

function ModuleTitleEditor({
  inputRef,
  value,
  moduleId,
  editValue,
  setEditValue,
  setIsEditing,
  fetcher,
}: TitleEditorProps & { moduleId: number }) {
  function handleSave() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      fetcher.submit(
        { intent: "rename-module", moduleId: String(moduleId), title: trimmed },
        { method: "post" }
      );
    }
    setIsEditing(false);
  }

  function handleCancel() {
    setEditValue(value);
    setIsEditing(false);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSave();
    } else if (event.key === "Escape") {
      handleCancel();
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={editValue}
      onChange={(event) => setEditValue(event.target.value)}
      onBlur={handleSave}
      onKeyDown={handleKeyDown}
      className="w-full rounded-md border border-input bg-background px-2 py-1 text-base font-semibold outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

export function InlineEditableModuleTitle({
  value,
  moduleId,
}: {
  value: string;
  moduleId: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const fetcher = useFetcher();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  if (isEditing) {
    return (
      <ModuleTitleEditor
        inputRef={inputRef}
        value={value}
        moduleId={moduleId}
        editValue={editValue}
        setEditValue={setEditValue}
        setIsEditing={setIsEditing}
        fetcher={fetcher}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="group flex items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-muted"
    >
      <h3 className="font-semibold">{value}</h3>
      <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function LessonTitleEditor({
  inputRef,
  value,
  lessonId,
  editValue,
  setEditValue,
  setIsEditing,
  fetcher,
}: TitleEditorProps & { lessonId: number }) {
  function handleSave() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      fetcher.submit(
        { intent: "rename-lesson", lessonId: String(lessonId), title: trimmed },
        { method: "post" }
      );
    }
    setIsEditing(false);
  }

  function handleCancel() {
    setEditValue(value);
    setIsEditing(false);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSave();
    } else if (event.key === "Escape") {
      handleCancel();
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={editValue}
      onChange={(event) => setEditValue(event.target.value)}
      onBlur={handleSave}
      onKeyDown={handleKeyDown}
      className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

export function InlineEditableLessonTitle({
  value,
  lessonId,
}: {
  value: string;
  lessonId: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const fetcher = useFetcher();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  if (isEditing) {
    return (
      <LessonTitleEditor
        inputRef={inputRef}
        value={value}
        lessonId={lessonId}
        editValue={editValue}
        setEditValue={setEditValue}
        setIsEditing={setIsEditing}
        fetcher={fetcher}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="group flex items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-sm hover:bg-muted"
    >
      <span className="flex-1">{value}</span>
      <Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
