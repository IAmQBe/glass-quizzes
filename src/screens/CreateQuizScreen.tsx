import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Trash2, Image, Clock, X, Upload, Loader2, Pencil, Sparkles } from "lucide-react";
import { useCreateQuiz, useSubmitForReview } from "@/hooks/useQuizzes";
import { useImageUpload, resizeImage } from "@/hooks/useImageUpload";
import { haptic } from "@/lib/telegram";
import { formatQuestionCount } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { GifImage } from "@/components/GifImage";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AiGenerateDialog } from "@/components/ai/AiGenerateDialog";
import type { AiQuizVariant } from "@/hooks/useAiGeneration";

interface CreateQuizScreenProps {
  onBack: () => void;
  onSuccess: (payload: CreateQuizSuccessPayload) => void;
}

export interface CreateQuizSuccessPayload {
  quizId: string;
  title: string;
  description?: string | null;
  isPendingModeration: boolean;
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
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [editQuestionIndex, setEditQuestionIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<QuestionDraft | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionDraft>({
    text: "",
    options: ["", "", "", ""],
    correctAnswer: 0,
  });

  // Image upload state
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string>("");
  const [coverPreview, setCoverPreview] = useState<string>("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [manualImageUrl, setManualImageUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createQuiz = useCreateQuiz();
  const submitForReview = useSubmitForReview();
  const { uploadImage, isUploading, progress } = useImageUpload();

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({ title: "Ошибка", description: "Используйте JPG, PNG, GIF или WebP" });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Ошибка", description: "Файл слишком большой (макс. 5MB)" });
      return;
    }

    haptic.selection();
    setCoverImage(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setCoverPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    haptic.selection();
    setCoverImage(null);
    setCoverPreview("");
    setCoverImageUrl("");
    setManualImageUrl("");
    setShowUrlInput(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSetManualUrl = () => {
    if (!manualImageUrl.trim()) {
      toast({ title: "Введите URL изображения" });
      return;
    }
    // Basic URL validation
    if (!manualImageUrl.startsWith('http://') && !manualImageUrl.startsWith('https://')) {
      toast({ title: "URL должен начинаться с http:// или https://" });
      return;
    }
    haptic.selection();
    setCoverImageUrl(manualImageUrl);
    setCoverPreview(manualImageUrl);
    setShowUrlInput(false);
  };

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

  const openEditQuestion = (index: number) => {
    const q = questions[index];
    if (!q) return;

    const padded = [...(q.options || [])];
    while (padded.length < 4) padded.push("");

    setEditQuestionIndex(index);
    setEditDraft({
      text: q.text,
      options: padded.slice(0, 4),
      correctAnswer: Math.max(0, Math.min(q.correctAnswer, Math.max(0, (q.options?.length || 1) - 1))),
    });
  };

  const saveEditedQuestion = () => {
    if (editQuestionIndex === null || !editDraft) return;

    const text = editDraft.text.trim();
    if (!text) {
      toast({ title: "Введите текст вопроса" });
      return;
    }

    const rawOptions = (editDraft.options || []).map((o) => o.trim());
    const validOptions = rawOptions.filter(Boolean);
    if (validOptions.length < 2) {
      toast({ title: "Добавьте минимум 2 варианта ответа" });
      return;
    }

    const correctText = (rawOptions[editDraft.correctAnswer] || "").trim();
    let newCorrect = validOptions.findIndex((o) => o === correctText);
    if (newCorrect < 0) newCorrect = 0;
    newCorrect = Math.max(0, Math.min(newCorrect, validOptions.length - 1));

    const updated = [...questions];
    updated[editQuestionIndex] = {
      text,
      options: validOptions,
      correctAnswer: newCorrect,
    };
    setQuestions(updated);
    setEditQuestionIndex(null);
    setEditDraft(null);
    toast({ title: "Вопрос обновлён" });
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: "Введите название" });
      return;
    }

    if (questions.length < 2) {
      toast({ title: "Добавьте минимум 2 вопроса" });
      return;
    }

    haptic.impact("medium");

    try {
      // Step 1: Get image URL (from upload, manual URL, or data URL)
      let imageUrl = coverImageUrl;

      if (coverImage && !imageUrl) {
        toast({ title: "Загружаем обложку..." });
        try {
          // Resize image before upload for optimization
          const resizedImage = await resizeImage(coverImage, 1200);
          imageUrl = await uploadImage(resizedImage);
          setCoverImageUrl(imageUrl);
        } catch (uploadError) {
          console.error("Image upload error:", uploadError);
          // Use data URL as fallback if upload fails
          if (coverPreview && coverPreview.startsWith('data:')) {
            console.log("Using data URL as fallback");
            imageUrl = coverPreview;
            toast({ title: "Используем локальное изображение" });
          } else {
            toast({ title: "Квиз будет создан без обложки" });
            imageUrl = undefined;
          }
        }
      } else if (!imageUrl && coverPreview) {
        // Use manual URL or data URL preview
        imageUrl = coverPreview;
      }

      // Step 2: Create quiz (pending or auto-published based on moderation settings)
      const quiz = await createQuiz.mutateAsync({
        title,
        description,
        image_url: imageUrl || undefined,
        duration_seconds: duration,
        is_anonymous: isAnonymous,
        questions: questions.map(q => ({
          text: q.text,
          options: q.options,
          correctAnswer: q.correctAnswer,
        })),
      });

      const quizStatus = (quiz as any)?.status;
      const isPendingModeration = quizStatus
        ? quizStatus === "pending"
        : (quiz as any)?.is_published !== true;

      // Step 3: Submit for review (notify admins) only for pending content
      if (isPendingModeration) {
        try {
          await submitForReview.mutateAsync({
            contentId: quiz.id,
            contentType: "quiz",
          });
        } catch (reviewError) {
          console.error("Submit for review error:", reviewError);
          // Quiz created, but notification failed - not critical
        }
      }

      haptic.notification("success");
      toast({
        title: "Квиз создан! 🎉",
        description: isPendingModeration
          ? "Отправлен на модерацию. Мы уведомим когда опубликуем."
          : "Сразу опубликован в прод."
      });
      onSuccess({
        quizId: quiz.id,
        title,
        description,
        isPendingModeration,
      });
    } catch (error: any) {
      console.error("Create quiz error:", error);
      haptic.notification("error");

      // Show detailed error message
      const errorMessage = error?.message || "Неизвестная ошибка";
      toast({
        title: "Ошибка",
        description: errorMessage
      });
    }
  };

  return (
    <motion.div
      className="flex flex-col min-h-screen pb-32"
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
              className={`flex-1 h-1 rounded-full ${["info", "questions", "preview"].indexOf(step) >= i
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
            {/* AI generation */}
            <div className="tg-section p-4">
              <button
                type="button"
                className="w-full py-3 rounded-xl bg-secondary text-foreground font-medium flex items-center justify-center gap-2 hover:bg-secondary/80"
                onClick={() => {
                  haptic.selection();
                  setAiOpen(true);
                }}
              >
                <Sparkles className="w-4 h-4 text-purple-500" />
                Создать с AI (3 варианта)
              </button>
              <p className="text-xs text-muted-foreground mt-2">
                Опиши тему и стиль. AI заполнит название, описание и вопросы. Картинки добавишь вручную.
              </p>
            </div>

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

            {/* Anonymous publishing */}
            <div className="tg-section p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground block">
                    Публиковать анонимно
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Лайки начисляются, но не идут в лидерборд.
                  </p>
                </div>
                <Switch
                  checked={isAnonymous}
                  onCheckedChange={(checked) => {
                    haptic.selection();
                    setIsAnonymous(checked);
                  }}
                />
              </div>
            </div>

            {/* Duration */}
            <div className="tg-section p-4">
              <label className="text-sm font-medium text-foreground block mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                Общее время (секунды)
              </label>
              <div className="flex gap-2">
                {[10, 15, 20, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      haptic.selection();
                      setDuration(d);
                    }}
                    className={`flex-1 py-2 rounded-lg font-medium transition-colors ${duration === d
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
                Обложка (опционально)
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleImageSelect}
                className="hidden"
              />

              {coverPreview ? (
                <div className="relative rounded-xl overflow-hidden">
                  <GifImage
                    src={coverPreview}
                    alt="Preview"
                    className="w-full h-48 object-cover"
                    onError={() => {
                      toast({ title: "Не удалось загрузить изображение" });
                      handleRemoveImage();
                    }}
                  />
                  <button
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 p-2 bg-background/80 backdrop-blur rounded-full text-destructive"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  {isUploading && (
                    <div className="absolute inset-0 bg-background/60 backdrop-blur flex items-center justify-center">
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
                        <p className="text-sm text-foreground">{progress}%</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : showUrlInput ? (
                <div className="space-y-2">
                  <input
                    type="url"
                    value={manualImageUrl}
                    onChange={(e) => setManualImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="w-full bg-secondary rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSetManualUrl}
                      className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg font-medium"
                    >
                      Применить
                    </button>
                    <button
                      onClick={() => {
                        setShowUrlInput(false);
                        setManualImageUrl("");
                      }}
                      className="px-4 py-2 bg-secondary text-foreground rounded-lg"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-6 border-2 border-dashed border-muted rounded-xl flex flex-col items-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <Upload className="w-8 h-8" />
                    <span className="text-sm">Нажмите для загрузки</span>
                    <span className="text-xs">JPG, PNG, GIF, WebP до 5MB</span>
                  </button>
                  <button
                    onClick={() => setShowUrlInput(true)}
                    className="w-full py-2 text-sm text-primary hover:underline"
                  >
                    Или вставьте URL изображения
                  </button>
                </div>
              )}
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
                      onClick={() => openEditQuestion(index)}
                      className="p-1 text-primary"
                      title="Редактировать"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
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
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${currentQuestion.correctAnswer === index
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
            <div className="tg-section overflow-hidden">
              {/* Cover image with edit button */}
              <div className="relative">
                {coverPreview ? (
                  <>
                    <GifImage
                      src={coverPreview}
                      alt={title}
                      className="w-full h-40 object-cover"
                    />
                    <button
                      onClick={() => {
                        haptic.selection();
                        fileInputRef.current?.click();
                      }}
                      className="absolute top-2 right-2 p-2 bg-background/80 backdrop-blur rounded-full text-foreground hover:bg-background/90 transition-colors"
                      title="Изменить обложку"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      haptic.selection();
                      fileInputRef.current?.click();
                    }}
                    className="w-full h-40 bg-secondary/50 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Image className="w-8 h-8" />
                    <span className="text-sm">Добавить обложку</span>
                  </button>
                )}
              </div>
              <div className="p-4">
                <h2 className="text-xl font-bold text-foreground mb-2">{title}</h2>
                {description && (
                  <p className="text-muted-foreground mb-4">{description}</p>
                )}
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>{formatQuestionCount(questions.length)}</span>
                  <span>{duration}с на квиз</span>
                </div>
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
                            className={`px-3 py-2 rounded-lg text-sm ${optIndex === q.correctAnswer
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
              className="tg-button w-full flex items-center justify-center gap-2"
              onClick={handleSubmit}
              disabled={createQuiz.isPending || isUploading}
            >
              {(createQuiz.isPending || isUploading) && (
                <Loader2 className="w-5 h-5 animate-spin" />
              )}
              {isUploading
                ? "Загружаем изображение..."
                : createQuiz.isPending
                  ? "Создаём квиз..."
                  : "Создать и отправить на модерацию"
              }
            </button>
          </motion.div>
        )}
      </div>

      {/* AI dialog */}
      <AiGenerateDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        contentType="quiz"
        onApply={(variant) => {
          const v = variant as AiQuizVariant;
          haptic.impact("light");
          setTitle(v.title || "");
          setDescription(v.description || "");
          setQuestions((v.questions || []).map((q) => ({
            text: q.text,
            options: q.options,
            correctAnswer: q.correctAnswer,
          })));
          setCurrentQuestion({ text: "", options: ["", "", "", ""], correctAnswer: 0 });
          setStep("questions");
          toast({ title: "Вариант применён", description: "Проверь вопросы и опубликуй квиз." });
        }}
      />

      {/* Edit question modal */}
      <Dialog
        open={editQuestionIndex !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setEditQuestionIndex(null);
            setEditDraft(null);
          }
        }}
      >
        <DialogContent className="max-w-lg rounded-2xl p-5">
          <DialogHeader className="text-left">
            <DialogTitle className="text-base">Редактировать вопрос</DialogTitle>
          </DialogHeader>

          {editDraft ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Текст вопроса</label>
                <textarea
                  value={editDraft.text}
                  onChange={(e) => setEditDraft({ ...editDraft, text: e.target.value })}
                  rows={2}
                  className="w-full bg-secondary rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Варианты ответа</label>
                <div className="space-y-2">
                  {(editDraft.options || []).map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          haptic.selection();
                          setEditDraft({ ...editDraft, correctAnswer: index });
                        }}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${editDraft.correctAnswer === index
                          ? "border-green-500 bg-green-500"
                          : "border-muted"
                          }`}
                        title="Правильный ответ"
                      >
                        {editDraft.correctAnswer === index ? (
                          <span className="text-white text-xs">✓</span>
                        ) : null}
                      </button>
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const next = [...(editDraft.options || [])];
                          next[index] = e.target.value;
                          setEditDraft({ ...editDraft, options: next });
                        }}
                        placeholder={`Option ${index + 1}`}
                        className="flex-1 bg-secondary rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Нажми на кружок, чтобы выбрать правильный ответ.
                </p>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" onClick={saveEditedQuestion}>
                  Сохранить
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setEditQuestionIndex(null);
                    setEditDraft(null);
                  }}
                >
                  Отмена
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};
