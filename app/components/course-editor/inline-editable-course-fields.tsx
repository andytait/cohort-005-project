import { useState, useRef, useEffect } from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import type { Fetcher } from "./types";

type EditorProps<T> = {
  inputRef: React.RefObject<T | null>;
  value: string;
  editValue: string;
  setEditValue: (value: string) => void;
  setIsEditing: (isEditing: boolean) => void;
  fetcher: Fetcher;
};

type DisplayProps = {
  value: string;
  setIsEditing: (isEditing: boolean) => void;
};

function TitleEditor({
  inputRef,
  value,
  editValue,
  setEditValue,
  setIsEditing,
  fetcher,
}: EditorProps<HTMLInputElement>) {
  function handleSave() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      fetcher.submit(
        { intent: "update-title", title: trimmed },
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
      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-3xl font-bold outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

export function InlineEditableTitle({
  value,
}: {
  value: string;
  courseId: number;
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
    if (fetcher.state === "idle" && fetcher.data?.success) {
      toast.success("Title saved.");
    }
    if (fetcher.state === "idle" && fetcher.data?.error) {
      toast.error(fetcher.data.error);
    }
  }, [fetcher.state, fetcher.data]);

  // Update local state when server responds with new data
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  if (isEditing) {
    return (
      <TitleEditor
        inputRef={inputRef}
        value={value}
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
      className="group flex w-full items-start gap-2 rounded-md px-3 py-1.5 text-left hover:bg-muted"
    >
      <h1 className="flex-1 text-3xl font-bold">{value}</h1>
      <Pencil className="mt-2 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

type DescriptionTextareaProps = {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  editValue: string;
  setEditValue: (value: string) => void;
  handleSave: () => void;
  handleKeyDown: (event: React.KeyboardEvent) => void;
};

function DescriptionTextarea({
  textareaRef,
  editValue,
  setEditValue,
  handleSave,
  handleKeyDown,
}: DescriptionTextareaProps) {
  return (
    <div>
      <textarea
        ref={textareaRef}
        value={editValue}
        onChange={(event) => {
          setEditValue(event.target.value);
          event.target.style.height = "auto";
          event.target.style.height = event.target.scrollHeight + "px";
        }}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        rows={3}
        className="w-full resize-none rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
      />
      <p className="mt-1 text-xs text-muted-foreground">
        Press Ctrl+Enter to save, Escape to cancel
      </p>
    </div>
  );
}

function DescriptionEditor({
  inputRef: textareaRef,
  value,
  editValue,
  setEditValue,
  setIsEditing,
  fetcher,
}: EditorProps<HTMLTextAreaElement>) {
  function handleSave() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      fetcher.submit(
        { intent: "update-description", description: trimmed },
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
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      handleSave();
    } else if (event.key === "Escape") {
      handleCancel();
    }
  }

  return (
    <DescriptionTextarea
      textareaRef={textareaRef}
      editValue={editValue}
      setEditValue={setEditValue}
      handleSave={handleSave}
      handleKeyDown={handleKeyDown}
    />
  );
}

function DescriptionDisplay({ value, setIsEditing }: DisplayProps) {
  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="group flex w-full items-start gap-2 rounded-md px-3 py-1.5 text-left hover:bg-muted"
    >
      <p className="flex-1 text-sm text-muted-foreground">{value}</p>
      <Pencil className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

export function InlineEditableDescription({
  value,
}: {
  value: string;
  courseId: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fetcher = useFetcher();

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
      // Auto-resize
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [isEditing]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      toast.success("Description saved.");
    }
    if (fetcher.state === "idle" && fetcher.data?.error) {
      toast.error(fetcher.data.error);
    }
  }, [fetcher.state, fetcher.data]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  if (isEditing) {
    return (
      <DescriptionEditor
        inputRef={textareaRef}
        value={value}
        editValue={editValue}
        setEditValue={setEditValue}
        setIsEditing={setIsEditing}
        fetcher={fetcher}
      />
    );
  }

  return <DescriptionDisplay value={value} setIsEditing={setIsEditing} />;
}
