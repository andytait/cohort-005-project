import { useState, useRef, useEffect } from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

type AddFieldsProps = {
  inputRef: React.RefObject<HTMLInputElement | null>;
  title: string;
  setTitle: (title: string) => void;
  setIsAdding: (isAdding: boolean) => void;
  handleSubmit: () => void;
};

function AddModuleFields({
  inputRef,
  title,
  setTitle,
  setIsAdding,
  handleSubmit,
}: AddFieldsProps) {
  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSubmit();
    } else if (event.key === "Escape") {
      setTitle("");
      setIsAdding(false);
    }
  }

  return (
    <div className="mt-4 flex items-center gap-2">
      <Input
        ref={inputRef}
        type="text"
        placeholder="Module title..."
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={handleKeyDown}
        className="max-w-xs"
      />
      <Button size="sm" onClick={handleSubmit} disabled={!title.trim()}>
        Add
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setTitle("");
          setIsAdding(false);
        }}
      >
        Cancel
      </Button>
    </div>
  );
}

function AddModuleButton({
  setIsAdding,
}: {
  setIsAdding: (isAdding: boolean) => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setIsAdding(true)}
      className="mt-4"
    >
      <Plus className="mr-1.5 size-4" />
      Add Module
    </Button>
  );
}

export function AddModuleForm() {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const fetcher = useFetcher();

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  // Reset form after successful submission
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      setTitle("");
      setIsAdding(false);
      toast.success("Module added.");
    }
    if (fetcher.state === "idle" && fetcher.data?.error) {
      toast.error(fetcher.data.error);
    }
  }, [fetcher.state, fetcher.data]);

  function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    fetcher.submit(
      { intent: "add-module", title: trimmed },
      { method: "post" }
    );
  }

  if (!isAdding) {
    return <AddModuleButton setIsAdding={setIsAdding} />;
  }

  return (
    <AddModuleFields
      inputRef={inputRef}
      title={title}
      setTitle={setTitle}
      setIsAdding={setIsAdding}
      handleSubmit={handleSubmit}
    />
  );
}

function AddLessonButton({
  setIsAdding,
}: {
  setIsAdding: (isAdding: boolean) => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setIsAdding(true)}
      className="mt-2 text-muted-foreground"
    >
      <Plus className="mr-1 size-3.5" />
      Add Lesson
    </Button>
  );
}

function AddLessonFields({
  inputRef,
  title,
  setTitle,
  setIsAdding,
  handleSubmit,
}: AddFieldsProps) {
  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSubmit();
    } else if (event.key === "Escape") {
      setTitle("");
      setIsAdding(false);
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <Input
        ref={inputRef}
        type="text"
        placeholder="Lesson title..."
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={handleKeyDown}
        className="max-w-xs text-sm"
      />
      <Button
        size="sm"
        className="h-8"
        onClick={handleSubmit}
        disabled={!title.trim()}
      >
        Add
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8"
        onClick={() => {
          setTitle("");
          setIsAdding(false);
        }}
      >
        Cancel
      </Button>
    </div>
  );
}

export function AddLessonForm({ moduleId }: { moduleId: number }) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const fetcher = useFetcher();

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      setTitle("");
      setIsAdding(false);
      toast.success("Lesson added.");
    }
    if (fetcher.state === "idle" && fetcher.data?.error) {
      toast.error(fetcher.data.error);
    }
  }, [fetcher.state, fetcher.data]);

  function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    fetcher.submit(
      { intent: "add-lesson", moduleId: String(moduleId), title: trimmed },
      { method: "post" }
    );
  }

  if (!isAdding) {
    return <AddLessonButton setIsAdding={setIsAdding} />;
  }

  return (
    <AddLessonFields
      inputRef={inputRef}
      title={title}
      setTitle={setTitle}
      setIsAdding={setIsAdding}
      handleSubmit={handleSubmit}
    />
  );
}
