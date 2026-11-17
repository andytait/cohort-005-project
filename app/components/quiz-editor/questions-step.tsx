import { GripVertical, Plus, Trash2 } from "lucide-react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DraggableProvided,
  type DraggableStateSnapshot,
  type DropResult,
} from "@hello-pangea/dnd";
import { QuestionType } from "~/db/schema";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { WizardQuestion, WizardState } from "./types";

type QuestionHandlers = {
  updateQuestion: (
    questionId: string,
    updates: Partial<WizardQuestion>
  ) => void;
  removeQuestion: (questionId: string) => void;
};

// ─── Step 2: Questions ───
export function QuestionsStep({
  wizard,
  handleQuestionDragEnd,
  updateQuestion,
  removeQuestion,
  addQuestion,
}: QuestionHandlers & {
  wizard: WizardState;
  handleQuestionDragEnd: (result: DropResult) => void;
  addQuestion: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Questions</h2>
          <p className="text-sm text-muted-foreground">
            Add questions to your quiz. Drag to reorder. You&apos;ll set answer
            options in the next step.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {wizard.questions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No questions added yet. Click &quot;Add Question&quot; to get
              started.
            </p>
          )}

          <QuestionList
            wizard={wizard}
            handleQuestionDragEnd={handleQuestionDragEnd}
            updateQuestion={updateQuestion}
            removeQuestion={removeQuestion}
          />

          <Button variant="outline" onClick={addQuestion}>
            <Plus className="mr-1.5 size-4" />
            Add Question
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function QuestionList({
  wizard,
  handleQuestionDragEnd,
  updateQuestion,
  removeQuestion,
}: QuestionHandlers & {
  wizard: WizardState;
  handleQuestionDragEnd: (result: DropResult) => void;
}) {
  return (
    <DragDropContext onDragEnd={handleQuestionDragEnd}>
      <Droppable droppableId="quiz-questions" type="question">
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="space-y-4"
          >
            {wizard.questions.map((q, idx) => (
              <Draggable key={q.id} draggableId={q.id} index={idx}>
                {(dragProvided, snapshot) => (
                  <QuestionRow
                    q={q}
                    idx={idx}
                    dragProvided={dragProvided}
                    snapshot={snapshot}
                    updateQuestion={updateQuestion}
                    removeQuestion={removeQuestion}
                  />
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}

function QuestionRow({
  q,
  idx,
  dragProvided,
  snapshot,
  updateQuestion,
  removeQuestion,
}: QuestionHandlers & {
  q: WizardQuestion;
  idx: number;
  dragProvided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
}) {
  return (
    <div
      ref={dragProvided.innerRef}
      {...dragProvided.draggableProps}
      className={`flex items-start gap-3 rounded-lg border p-4 ${
        snapshot.isDragging ? "bg-muted shadow-lg ring-2 ring-primary/20" : ""
      }`}
    >
      <div
        {...dragProvided.dragHandleProps}
        className="mt-2 cursor-grab text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="size-4" />
      </div>
      <span className="mt-2 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
        {idx + 1}
      </span>
      <QuestionFields q={q} updateQuestion={updateQuestion} />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => removeQuestion(q.id)}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

function QuestionFields({
  q,
  updateQuestion,
}: Pick<QuestionHandlers, "updateQuestion"> & { q: WizardQuestion }) {
  return (
    <div className="flex-1 space-y-3">
      <Input
        value={q.text}
        onChange={(event) =>
          updateQuestion(q.id, {
            text: event.target.value,
          })
        }
        placeholder="Enter question text..."
      />
      <QuestionTypeSelect q={q} updateQuestion={updateQuestion} />
    </div>
  );
}

function QuestionTypeSelect({
  q,
  updateQuestion,
}: Pick<QuestionHandlers, "updateQuestion"> & { q: WizardQuestion }) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs text-muted-foreground">Type:</Label>
      <Select
        value={q.type}
        onValueChange={(value) =>
          updateQuestion(q.id, {
            type: value as QuestionType,
          })
        }
      >
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={QuestionType.MultipleChoice}>
            Multiple Choice
          </SelectItem>
          <SelectItem value={QuestionType.TrueFalse}>True / False</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
