import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Trash2, Image, X, Upload, Loader2, Pencil, Sparkles, ChevronRight, ChevronLeft } from "lucide-react";
import { useCreatePersonalityTest } from "@/hooks/usePersonalityTests";
import { useImageUpload, resizeImage } from "@/hooks/useImageUpload";
import { haptic } from "@/lib/telegram";
import { formatQuestionCount } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { GifImage } from "@/components/GifImage";
import { Switch } from "@/components/ui/switch";

interface CreatePersonalityTestScreenProps {
  onBack: () => void;
  onSuccess: () => void;
}

interface ResultDraft {
  result_key: string;
  title: string;
  description: string;
  image_url: string;
  share_text: string;
}

interface QuestionDraft {
  question_text: string;
  image_url: string;
  answers: {
    answer_text: string;
    result_points: Record<string, number>;
  }[];
}

type Step = "info" | "results" | "questions" | "preview";

export const CreatePersonalityTestScreen = ({ onBack, onSuccess }: CreatePersonalityTestScreenProps) => {
  const [step, setStep] = useState<Step>("info");

  // Basic info
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Results (characters)
  const [results, setResults] = useState<ResultDraft[]>([
    { result_key: "result_1", title: "", description: "", image_url: "", share_text: "" },
    { result_key: "result_2", title: "", description: "", image_url: "", share_text: "" },
  ]);

  // Questions
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionDraft>({
    question_text: "",
    image_url: "",
    answers: results.map((r) => ({ answer_text: "", result_points: { [r.result_key]: 1 } })),
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const createTest = useCreatePersonalityTest();
  const { uploadImage, isUploading } = useImageUpload();

  // ===== Handlers =====

  const handleBack = () => {
    haptic.selection();
    if (step === "info") {
      onBack();
    } else if (step === "results") {
      setStep("info");
    } else if (step === "questions") {
      setStep("results");
    } else {
      setStep("questions");
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({ title: "Ошибка", description: "Используйте JPG, PNG, GIF или WebP" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Ошибка", description: "Файл слишком большой (макс. 5MB)" });
      return;
    }

    haptic.selection();
    setCoverImage(file);

    const reader = new FileReader();
    reader.onload = (e) => setCoverPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleNextStep = () => {
    haptic.selection();

    if (step === "info") {
      if (!title.trim()) {
        toast({ title: "Введите название теста" });
        return;
      }
      setStep("results");
    } else if (step === "results") {
      const validResults = results.filter(r => r.title.trim() && r.description.trim());
      if (validResults.length < 2) {
        toast({ title: "Добавьте минимум 2 результата с названием и описанием" });
        return;
      }
      // Update answers to match results
      setCurrentQuestion(prev => ({
        ...prev,
        answers: results.map(r => ({
          answer_text: "",
          result_points: { [r.result_key]: 1 }
        }))
      }));
      setStep("questions");
    } else if (step === "questions") {
      if (questions.length < 2) {
        toast({ title: "Добавьте минимум 2 вопроса" });
        return;
      }
      setStep("preview");
    }
  };

  // ===== Results Management =====

  const addResult = () => {
    haptic.selection();
    const newKey = `result_${results.length + 1}`;
    setResults([...results, { result_key: newKey, title: "", description: "", image_url: "", share_text: "" }]);
  };

  const removeResult = (index: number) => {
    if (results.length <= 2) {
      toast({ title: "Минимум 2 результата" });
      return;
    }
    haptic.selection();
    setResults(results.filter((_, i) => i !== index));
  };

  const updateResult = (index: number, field: keyof ResultDraft, value: string) => {
    const updated = [...results];
    updated[index] = { ...updated[index], [field]: value };
    setResults(updated);
  };

  // ===== Questions Management =====

  const addQuestion = () => {
    if (!currentQuestion.question_text.trim()) {
      toast({ title: "Введите текст вопроса" });
      return;
    }

    const validAnswers = currentQuestion.answers.filter(a => a.answer_text.trim());
    if (validAnswers.length < 2) {
      toast({ title: "Добавьте минимум 2 варианта ответа" });
      return;
    }

    haptic.selection();
    setQuestions([...questions, { ...currentQuestion, answers: validAnswers }]);
    setCurrentQuestion({
      question_text: "",
      image_url: "",
      answers: results.map(r => ({ answer_text: "", result_points: { [r.result_key]: 1 } })),
    });
  };

  const removeQuestion = (index: number) => {
    haptic.selection();
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateAnswerText = (answerIndex: number, text: string) => {
    const updated = { ...currentQuestion };
    updated.answers[answerIndex].answer_text = text;
    setCurrentQuestion(updated);
  };

  const updateAnswerPoints = (answerIndex: number, resultKey: string, points: number) => {
    const updated = { ...currentQuestion };
    updated.answers[answerIndex].result_points = {
      ...updated.answers[answerIndex].result_points,
      [resultKey]: points
    };
    setCurrentQuestion(updated);
  };

  // ===== Submit =====

  const handleSubmit = async () => {
    haptic.impact('medium');

    try {
      let imageUrl = coverPreview;

      if (coverImage) {
        const resized = await resizeImage(coverImage);
        const uploaded = await uploadImage(resized);
        if (uploaded) imageUrl = uploaded;
      }

      const validResults = results.filter(r => r.title.trim() && r.description.trim());

      await createTest.mutateAsync({
        title,
        description,
        image_url: imageUrl || undefined,
        is_anonymous: isAnonymous,
        results: validResults,
        questions: questions,
      });

      haptic.notification('success');
      toast({ title: "Тест создан!", description: "Отправлен на модерацию" });
      onSuccess();
    } catch (error: any) {
      console.error("Create test error:", error);
      toast({ title: "Ошибка", description: error.message || "Не удалось создать тест" });
    }
  };

  // ===== Render Steps =====

  const renderInfoStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-purple-500" />
        <h2 className="text-lg font-semibold">Основная информация</h2>
      </div>

      {/* Cover Image */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Обложка</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />

        {coverPreview ? (
          <div className="relative rounded-xl overflow-hidden">
            <GifImage src={coverPreview} alt="" className="w-full h-40 object-cover" />
            <button
              className="absolute top-2 right-2 p-2 rounded-full bg-black/50 text-white"
              onClick={() => { setCoverImage(null); setCoverPreview(""); }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            className="w-full h-32 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-6 h-6" />
            <span className="text-sm">Загрузить изображение</span>
          </button>
        )}
      </div>

      {/* Title */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Название теста</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Кто ты из Симпсонов?"
          className="w-full p-3 rounded-xl bg-muted border border-border text-foreground"
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Описание</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Узнай какой персонаж тебе ближе всего..."
          className="w-full p-3 rounded-xl bg-muted border border-border text-foreground min-h-[80px] resize-none"
        />
      </div>

      {/* Anonymous publishing */}
      <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">Публиковать анонимно</p>
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
  );

  const renderResultsStep = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h2 className="text-lg font-semibold">Результаты ({results.length})</h2>
        </div>
        <button
          className="text-sm text-primary flex items-center gap-1"
          onClick={addResult}
        >
          <Plus className="w-4 h-4" /> Добавить
        </button>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Добавьте персонажей или типы, которые могут получить пользователи
      </p>

      <div className="space-y-4">
        {results.map((result, index) => (
          <div key={result.result_key} className="p-4 rounded-xl bg-card border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-purple-500">Результат {index + 1}</span>
              {results.length > 2 && (
                <button onClick={() => removeResult(index)} className="text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <input
              type="text"
              value={result.title}
              onChange={(e) => updateResult(index, "title", e.target.value)}
              placeholder="Название (например: Гомер Симпсон)"
              className="w-full p-2 rounded-lg bg-muted border border-border text-foreground text-sm"
            />

            <textarea
              value={result.description}
              onChange={(e) => updateResult(index, "description", e.target.value)}
              placeholder="Описание персонажа..."
              className="w-full p-2 rounded-lg bg-muted border border-border text-foreground text-sm min-h-[60px] resize-none"
            />

            <input
              type="text"
              value={result.image_url}
              onChange={(e) => updateResult(index, "image_url", e.target.value)}
              placeholder="URL картинки (опционально)"
              className="w-full p-2 rounded-lg bg-muted border border-border text-foreground text-sm"
            />
          </div>
        ))}
      </div>
    </div>
  );

  const renderQuestionsStep = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h2 className="text-lg font-semibold">Вопросы ({questions.length})</h2>
        </div>
      </div>

      {/* Existing questions */}
      {questions.length > 0 && (
        <div className="space-y-2 mb-4">
          {questions.map((q, index) => (
            <div key={index} className="p-3 rounded-xl bg-card border border-border flex items-center justify-between">
              <span className="text-sm text-foreground line-clamp-1 flex-1">{q.question_text}</span>
              <button onClick={() => removeQuestion(index)} className="text-red-500 ml-2">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* New question form */}
      <div className="p-4 rounded-xl bg-card border border-border space-y-4">
        <h3 className="font-medium text-foreground">Новый вопрос</h3>

        <input
          type="text"
          value={currentQuestion.question_text}
          onChange={(e) => setCurrentQuestion({ ...currentQuestion, question_text: e.target.value })}
          placeholder="Текст вопроса"
          className="w-full p-3 rounded-xl bg-muted border border-border text-foreground"
        />

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Варианты ответов (каждый даёт очки к результату):</p>

          {results.filter(r => r.title.trim()).map((result, rIndex) => (
            <div key={result.result_key} className="space-y-2">
              <label className="text-xs text-purple-500 font-medium">
                → {result.title || `Результат ${rIndex + 1}`}
              </label>
              <input
                type="text"
                value={currentQuestion.answers[rIndex]?.answer_text || ""}
                onChange={(e) => updateAnswerText(rIndex, e.target.value)}
                placeholder={`Ответ, ведущий к "${result.title}"`}
                className="w-full p-2 rounded-lg bg-muted border border-border text-foreground text-sm"
              />
            </div>
          ))}
        </div>

        <button
          className="tg-button-secondary w-full flex items-center justify-center gap-2"
          onClick={addQuestion}
        >
          <Plus className="w-4 h-4" /> Добавить вопрос
        </button>
      </div>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-purple-500" />
        <h2 className="text-lg font-semibold">Предпросмотр</h2>
      </div>

      {/* Preview card */}
      <div className="p-4 rounded-xl bg-card border border-border space-y-3">
        {coverPreview && (
          <GifImage src={coverPreview} alt="" className="w-full h-32 object-cover rounded-xl" />
        )}
        <h3 className="font-semibold text-lg text-foreground">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{formatQuestionCount(questions.length)}</span>
          <span>{results.filter(r => r.title.trim()).length} результатов</span>
        </div>
      </div>

      {/* Results preview */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-foreground">Возможные результаты:</h4>
        {results.filter(r => r.title.trim()).map((r, i) => (
          <div key={i} className="p-2 rounded-lg bg-muted text-sm">
            <span className="font-medium">{r.title}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <motion.div
      className="min-h-screen flex flex-col pb-32"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <div className="sticky top-0 bg-background/80 backdrop-blur-lg z-10 px-4 py-3 border-b border-border">
        <div className="flex items-center">
          <button className="p-2 -ml-2 text-primary" onClick={handleBack}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="flex-1 text-center text-lg font-semibold text-foreground pr-8">
            Создать тест
          </h1>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mt-2">
          {(["info", "results", "questions", "preview"] as Step[]).map((s, i) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-colors ${step === s ? "bg-purple-500" : "bg-muted"
                }`}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4">
        {step === "info" && renderInfoStep()}
        {step === "results" && renderResultsStep()}
        {step === "questions" && renderQuestionsStep()}
        {step === "preview" && renderPreviewStep()}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        {step !== "preview" ? (
          <button className="tg-button w-full flex items-center justify-center gap-2" onClick={handleNextStep}>
            Далее <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            className="tg-button w-full flex items-center justify-center gap-2"
            onClick={handleSubmit}
            disabled={createTest.isPending || isUploading}
          >
            {(createTest.isPending || isUploading) ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Создание...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Создать тест
              </>
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
};
