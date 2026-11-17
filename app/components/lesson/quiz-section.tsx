import { useState, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { useFetcher } from "react-router";
import { toast } from "sonner";
import { HelpCircle, RotateCcw, Trophy } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { QuizResultCard } from "./quiz-result";
import type { BestAttempt, LessonQuiz, QuizResult } from "./types";

type SetSelectedAnswers = Dispatch<SetStateAction<Record<number, number>>>;

function useQuizResultToast(quizResult: QuizResult | null, retaking: boolean) {
  useEffect(() => {
    if (quizResult && !retaking) {
      if (quizResult.passed) {
        toast.success(
          `Quiz passed! Score: ${Math.round(quizResult.score * 100)}%`
        );
      } else {
        toast.error(
          `Quiz not passed. Score: ${Math.round(quizResult.score * 100)}%`
        );
      }
    }
  }, [quizResult, retaking]);
}

export function QuizSection({
  quiz,
  bestAttempt,
  quizResult,
  quizFetcher,
  isSubmitting,
}: {
  quiz: LessonQuiz;
  bestAttempt: BestAttempt;
  quizResult: QuizResult | null;
  quizFetcher: ReturnType<typeof useFetcher>;
  isSubmitting: boolean;
}) {
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<number, number>
  >({});
  const [showQuiz, setShowQuiz] = useState(!bestAttempt?.passed);
  const [retaking, setRetaking] = useState(false);

  useQuizResultToast(quizResult, retaking);

  const showResult = quizResult && !retaking;

  if (showResult) {
    return (
      <QuizResultCard
        quiz={quiz}
        quizResult={quizResult}
        setSelectedAnswers={setSelectedAnswers}
        setRetaking={setRetaking}
      />
    );
  }

  if (!showQuiz && bestAttempt?.passed) {
    return (
      <QuizPassedCard
        quiz={quiz}
        bestAttempt={bestAttempt}
        setShowQuiz={setShowQuiz}
      />
    );
  }

  return (
    <QuizForm
      quiz={quiz}
      quizFetcher={quizFetcher}
      selectedAnswers={selectedAnswers}
      setSelectedAnswers={setSelectedAnswers}
      setRetaking={setRetaking}
      isSubmitting={isSubmitting}
    />
  );
}

function QuizPassedCard({
  quiz,
  bestAttempt,
  setShowQuiz,
}: {
  quiz: LessonQuiz;
  bestAttempt: NonNullable<BestAttempt>;
  setShowQuiz: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-green-600" />
            <span className="font-medium">{quiz.title}</span>
            <span className="text-sm text-muted-foreground">
              Best score: {Math.round(bestAttempt.score * 100)}%
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowQuiz(true)}>
            <RotateCcw className="mr-2 size-4" />
            Retake
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function QuizForm({
  quiz,
  quizFetcher,
  selectedAnswers,
  setSelectedAnswers,
  setRetaking,
  isSubmitting,
}: {
  quiz: LessonQuiz;
  quizFetcher: ReturnType<typeof useFetcher>;
  selectedAnswers: Record<number, number>;
  setSelectedAnswers: SetSelectedAnswers;
  setRetaking: Dispatch<SetStateAction<boolean>>;
  isSubmitting: boolean;
}) {
  const allAnswered = quiz.questions.every(
    (q) => selectedAnswers[q.id] !== undefined
  );

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <QuizFormIntro quiz={quiz} />

        <quizFetcher.Form method="post" onSubmit={() => setRetaking(false)}>
          <input type="hidden" name="intent" value="submit-quiz" />
          <input type="hidden" name="quizId" value={quiz.id} />

          <div className="space-y-6">
            {quiz.questions.map((question, qIndex) => (
              <QuizQuestionField
                key={question.id}
                question={question}
                qIndex={qIndex}
                selectedAnswers={selectedAnswers}
                setSelectedAnswers={setSelectedAnswers}
              />
            ))}
          </div>

          <QuizSubmitFooter
            allAnswered={allAnswered}
            isSubmitting={isSubmitting}
          />
        </quizFetcher.Form>
      </CardContent>
    </Card>
  );
}

function QuizFormIntro({ quiz }: { quiz: LessonQuiz }) {
  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <HelpCircle className="size-5 text-primary" />
        <h2 className="text-xl font-semibold">{quiz.title}</h2>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Answer all questions and submit. Passing score:{" "}
        {Math.round(quiz.passingScore * 100)}%.
      </p>
    </>
  );
}

function QuizSubmitFooter({
  allAnswered,
  isSubmitting,
}: {
  allAnswered: boolean;
  isSubmitting: boolean;
}) {
  return (
    <div className="mt-6">
      <Button type="submit" disabled={!allAnswered || isSubmitting}>
        {isSubmitting ? "Submitting..." : "Submit Quiz"}
      </Button>
      {!allAnswered && (
        <p className="mt-2 text-sm text-muted-foreground">
          Please answer all questions before submitting.
        </p>
      )}
    </div>
  );
}

function QuizQuestionField({
  question,
  qIndex,
  selectedAnswers,
  setSelectedAnswers,
}: {
  question: LessonQuiz["questions"][number];
  qIndex: number;
  selectedAnswers: Record<number, number>;
  setSelectedAnswers: SetSelectedAnswers;
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="mb-3 font-medium">
        {qIndex + 1}. {question.questionText}
      </p>
      <div className="space-y-2">
        {question.options.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-muted"
          >
            <input
              type="radio"
              name={`question-${question.id}`}
              value={option.id}
              checked={selectedAnswers[question.id] === option.id}
              onChange={() =>
                setSelectedAnswers((prev) => ({
                  ...prev,
                  [question.id]: option.id,
                }))
              }
              className="size-4 accent-primary"
            />
            <span className="text-sm">{option.optionText}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
