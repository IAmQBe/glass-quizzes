import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Trash2, Image, Clock, X } from "lucide-react";
import { useCreateQuiz } from "@/hooks/useQuizzes";
import { haptic } from "@/lib/telegram";
import { toast } from "@/hooks/use-toast";

interface CreateQuizScreenProps {
  onBack: () => void;
  onSuccess: () => void;
}

interface QuestionDraft {
  text: string;
  options: string[];
  correctAnswer: number;
}

export const CreateQuizScreen = ({ onBack, onSuccess }: CreateQuizScreenProps) => {
  const [step, setStep] = useState<"info" | "questions" | "preview">("info");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(60);
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionDraft>({
    text: "",
    options: ["", "", "", ""],
    correctAnswer: 0,
  });

  const createQuiz = useCreateQuiz();

  const handleBack = () => {
    haptic.selection();
    if (step === "questions" && questions.length === 0) {
      setStep("info");
    } else if (step === "preview") {
      setStep("questions");
    } else {
      onBack();
    }
  };

  const handleAddQuestion = () => {
    if (!currentQuestion.text.trim()) {
      toast({ title: "Please enter a question" });
      return;
    }

    const validOptions = currentQuestion.options.filter((o) => o.trim());
    if (validOptions.length < 2) {
      toast({ title: "Please add at least 2 options" });
      return;
    }

    haptic.impact("light");
    setQuestions([...questions, { ...currentQuestion, options: validOptions }]);
    setCurrentQuestion({
      text: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
    });
  };

  const handleRemoveQuestion = (index: number) => {
    haptic.notification("warning");
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: "Please enter a title" });
      return;
    }

    if (questions.length < 2) {
      toast({ title: "Please add at least 2 questions" });
      return;
    }

    haptic.impact("medium");

    try {
      await createQuiz.mutateAsync({
        title,
        description,
        duration_seconds: duration,
      });

      toast({ title: "Quiz created!", description: "Your quiz is now in drafts" });
      onSuccess();
    } catch (error) {
      toast({ title: "Error", description: "Failed to create quiz" });
    }
  };

  return (
    <motion.div
      className="flex flex-col min-h-screen pb-24"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <div className="sticky top-0 bg-background/80 backdrop-blur-lg z-10 px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <button className="p-2 -ml-2 text-primary" onClick={handleBack}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">
            {step === "info" ? "New Quiz" : step === "questions" ? "Add Questions" : "Preview"}
          </h1>
          <div className="w-10" />
        </div>

        {/* Progress Steps */}
        <div className="flex gap-2 mt-3">
          {["info", "questions", "preview"].map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full ${
                ["info", "questions", "preview"].indexOf(step) >= i
                  ? "bg-primary"
                  : "bg-secondary"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {step === "info" && (
          <motion.div
            className="space-y-4"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
          >
            {/* Title */}
            <div className="tg-section p-4">
              <label className="text-sm font-medium text-foreground block mb-2">
                Quiz Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., How well do you know React?"
                className="w-full bg-secondary rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Description */}
            <div className="tg-section p-4">
              <label className="text-sm font-medium text-foreground block mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this quiz about?"
                rows={3}
                className="w-full bg-secondary rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            {/* Duration */}
            <div className="tg-section p-4">
              <label className="text-sm font-medium text-foreground block mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                Time per question (seconds)
              </label>
              <div className="flex gap-2">
                {[10, 15, 20, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      haptic.selection();
                      setDuration(d);
                    }}
                    className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                      duration === d
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground"
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>

            {/* Cover Image */}
            <div className="tg-section p-4">
              <label className="text-sm font-medium text-foreground block mb-2">
                <Image className="w-4 h-4 inline mr-1" />
                Cover Image (optional)
              </label>
              <button className="w-full py-8 border-2 border-dashed border-muted rounded-xl flex flex-col items-center gap-2 text-muted-foreground">
                <Plus className="w-8 h-8" />
                <span className="text-sm">Tap to upload</span>
              </button>
            </div>

            <button
              className="tg-button w-full"
              onClick={() => {
                if (!title.trim()) {
                  toast({ title: "Please enter a title" });
                  return;
                }
                haptic.impact("medium");
                setStep("questions");
              }}
            >
              Add Questions
            </button>
          </motion.div>
        )}

        {step === "questions" && (
          <motion.div
            className="space-y-4"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
          >
            {/* Added Questions */}
            {questions.length > 0 && (
              <div className="tg-section divide-y divide-border">
                {questions.map((q, index) => (
                  <div key={index} className="p-4 flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center font-medium">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-foreground font-medium line-clamp-2">
                        {q.text}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {q.options.length} options
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveQuestion(index)}
                      className="p-1 text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* New Question Form */}
            <div className="tg-section p-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Question #{questions.length + 1}
                </label>
                <textarea
                  value={currentQuestion.text}
                  onChange={(e) =>
                    setCurrentQuestion({ ...currentQuestion, text: e.target.value })
                  }
                  placeholder="Enter your question..."
                  rows={2}
                  className="w-full bg-secondary rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Answer options
                </label>
                <div className="space-y-2">
                  {currentQuestion.options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          haptic.selection();
                          setCurrentQuestion({
                            ...currentQuestion,
                            correctAnswer: index,
                          });
                        }}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          currentQuestion.correctAnswer === index
                            ? "border-green-500 bg-green-500"
                            : "border-muted"
                        }`}
                      >
                        {currentQuestion.correctAnswer === index && (
                          <span className="text-white text-xs">✓</span>
                        )}
                      </button>
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...currentQuestion.options];
                          newOptions[index] = e.target.value;
                          setCurrentQuestion({
                            ...currentQuestion,
                            options: newOptions,
                          });
                        }}
                        placeholder={`Option ${index + 1}`}
                        className="flex-1 bg-secondary rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Tap the circle to mark correct answer
                </p>
              </div>

              <button
                className="tg-button-secondary w-full flex items-center justify-center gap-2"
                onClick={handleAddQuestion}
              >
                <Plus className="w-5 h-5" />
                Add Question
              </button>
            </div>

            {questions.length >= 2 && (
              <button
                className="tg-button w-full"
                onClick={() => {
                  haptic.impact("medium");
                  setStep("preview");
                }}
              >
                Preview Quiz ({questions.length} questions)
              </button>
            )}
          </motion.div>
        )}

        {step === "preview" && (
          <motion.div
            className="space-y-4"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
          >
            <div className="tg-section p-4">
              <h2 className="text-xl font-bold text-foreground mb-2">{title}</h2>
              {description && (
                <p className="text-muted-foreground mb-4">{description}</p>
              )}
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>{questions.length} questions</span>
                <span>{duration}s per question</span>
              </div>
            </div>

            <div className="tg-section divide-y divide-border">
              {questions.map((q, index) => (
                <div key={index} className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center font-medium">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-foreground font-medium mb-2">{q.text}</p>
                      <div className="space-y-1">
                        {q.options.map((opt, optIndex) => (
                          <div
                            key={optIndex}
                            className={`px-3 py-2 rounded-lg text-sm ${
                              optIndex === q.correctAnswer
                                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                : "bg-secondary text-foreground"
                            }`}
                          >
                            {opt}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              className="tg-button w-full"
              onClick={handleSubmit}
              disabled={createQuiz.isPending}
            >
              {createQuiz.isPending ? "Creating..." : "Create Quiz"}
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};