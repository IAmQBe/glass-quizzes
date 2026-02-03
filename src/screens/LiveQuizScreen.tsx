import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Users, Play, Crown, Zap, Star, Copy, Check } from "lucide-react";
import { haptic, getTelegramUser } from "@/lib/telegram";
import {
  useLiveQuiz,
  useLiveQuizReactions,
  useJoinLiveQuiz,
  useStartLiveQuiz,
  useSendReaction,
  useNextQuestion,
  useEndLiveQuiz,
  LiveQuizReaction,
} from "@/hooks/useLiveQuiz";
import { useQuizWithQuestions } from "@/hooks/useQuizzes";
import { PopcornIcon } from "@/components/icons/PopcornIcon";
import { toast } from "@/hooks/use-toast";

interface LiveQuizScreenProps {
  liveQuizId: string;
  onBack: () => void;
}

const REACTION_EMOJIS = ["🔥", "👏", "😂", "😮", "🎉", "💪", "🧠", "⚡"];

export const LiveQuizScreen = ({ liveQuizId, onBack }: LiveQuizScreenProps) => {
  const user = getTelegramUser();
  const { data, refetch, isLoading } = useLiveQuiz(liveQuizId);
  const joinQuiz = useJoinLiveQuiz();
  const startQuiz = useStartLiveQuiz();
  const sendReaction = useSendReaction();
  const nextQuestion = useNextQuestion();
  const endQuiz = useEndLiveQuiz();

  const [reactions, setReactions] = useState<Array<{ id: string; emoji: string; x: number }>>([]);
  const [copied, setCopied] = useState(false);
  const [answerStartTime, setAnswerStartTime] = useState<number | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  const liveQuiz = data?.liveQuiz;
  const participants = data?.participants || [];
  const quizId = (liveQuiz as any)?.quiz_id;

  const { data: quizData } = useQuizWithQuestions(quizId);
  const questions = quizData?.questions || [];
  const currentQuestionData = questions[(liveQuiz as any)?.current_question ?? 0];

  const isHost = user?.id && String(user.id) === (liveQuiz as any)?.host_user_id;
  const isParticipant = participants.some((p: any) => p.user_id === user?.id);
  const isWaiting = (liveQuiz as any)?.status === "waiting";
  const isActive = (liveQuiz as any)?.status === "active";
  const isFinished = (liveQuiz as any)?.status === "finished";

  // Handle incoming reactions
  const handleReaction = useCallback((reaction: LiveQuizReaction) => {
    const id = `${reaction.id}-${Date.now()}`;
    const x = Math.random() * 80 + 10; // 10-90% of screen width
    setReactions((prev) => [...prev, { id, emoji: reaction.emoji, x }]);
    
    // Remove after animation
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2000);
  }, []);

  useLiveQuizReactions(liveQuizId, handleReaction);

  // Reset answer state when question changes
  useEffect(() => {
    setSelectedAnswer(null);
    setAnswerStartTime(Date.now());
  }, [(liveQuiz as any)?.current_question]);

  const handleBack = () => {
    haptic.selection();
    onBack();
  };

  const handleJoin = async () => {
    haptic.impact('medium');
    try {
      await joinQuiz.mutateAsync(liveQuizId);
      refetch();
    } catch (error) {
      toast({ title: "Не удалось присоединиться", variant: "destructive" });
    }
  };

  const handleStart = async () => {
    haptic.impact('heavy');
    try {
      await startQuiz.mutateAsync(liveQuizId);
    } catch (error) {
      toast({ title: "Не удалось начать", variant: "destructive" });
    }
  };

  const handleSendReaction = (emoji: string) => {
    haptic.impact('light');
    sendReaction.mutate({ live_quiz_id: liveQuizId, emoji });
  };

  const handleCopyLink = () => {
    const link = `https://t.me/mindtest_bot?start=live_${liveQuizId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    haptic.notification('success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNextQuestion = async () => {
    haptic.impact('medium');
    if ((liveQuiz as any)?.current_question >= questions.length - 1) {
      await endQuiz.mutateAsync(liveQuizId);
    } else {
      await nextQuestion.mutateAsync(liveQuizId);
    }
  };

  const handleAnswer = (answerIndex: number) => {
    if (selectedAnswer !== null) return;
    
    haptic.impact('medium');
    setSelectedAnswer(answerIndex);
    
    // TODO: Submit answer with timing
    // const timeMs = answerStartTime ? Date.now() - answerStartTime : 0;
    // const isCorrect = answerIndex === currentQuestionData?.correct_answer;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-screen flex flex-col bg-background"
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
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            <span className="font-semibold text-foreground">Live Quiz</span>
          </div>
          <div className="flex items-center gap-1 bg-red-500/10 px-2 py-1 rounded-full">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs text-red-500 font-medium">LIVE</span>
          </div>
        </div>
      </div>

      {/* Floating Reactions */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        <AnimatePresence>
          {reactions.map((reaction) => (
            <motion.div
              key={reaction.id}
              className="absolute text-3xl"
              style={{ left: `${reaction.x}%` }}
              initial={{ y: "100vh", opacity: 1, scale: 0.5 }}
              animate={{ y: "-100vh", opacity: 0, scale: 1.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2, ease: "easeOut" }}
            >
              {reaction.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* Waiting Room */}
        {isWaiting && (
          <>
            <motion.div
              className="tg-section p-6 text-center"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">
                Ожидание участников
              </h2>
              <p className="text-muted-foreground mb-4">
                {participants.length} / {(liveQuiz as any)?.max_participants} участников
              </p>

              {/* Invite link */}
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-2 mx-auto px-4 py-2 bg-secondary rounded-lg text-sm"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" />
                    Скопировано!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Скопировать ссылку
                  </>
                )}
              </button>
            </motion.div>

            {/* Participants List */}
            <div className="tg-section p-4">
              <h3 className="font-semibold text-foreground mb-3">Участники</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {participants.map((p: any, i: number) => (
                  <motion.div
                    key={p.id}
                    className="flex items-center gap-3"
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-sm">🧠</span>
                    </div>
                    <span className="text-foreground">
                      {p.profiles?.first_name || `Player ${i + 1}`}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Actions */}
            {!isParticipant && !isHost && (
              <button className="tg-button w-full" onClick={handleJoin}>
                Присоединиться
              </button>
            )}

            {isHost && participants.length >= 1 && (
              <button className="tg-button w-full flex items-center justify-center gap-2" onClick={handleStart}>
                <Play className="w-5 h-5" />
                Начать квиз
              </button>
            )}
          </>
        )}

        {/* Active Quiz */}
        {isActive && currentQuestionData && (
          <>
            {/* Question */}
            <motion.div
              className="tg-section p-6"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">
                  Вопрос {(liveQuiz as any)?.current_question + 1} / {questions.length}
                </span>
                <div className="flex items-center gap-1 text-primary">
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-medium">{participants.length}</span>
                </div>
              </div>

              <h2 className="text-lg font-semibold text-foreground mb-6">
                {currentQuestionData.question_text}
              </h2>

              {/* Answer options */}
              <div className="space-y-3">
                {currentQuestionData.options.map((option, index) => (
                  <motion.button
                    key={index}
                    className={`w-full p-4 rounded-xl text-left transition-colors ${
                      selectedAnswer === index
                        ? index === currentQuestionData.correct_answer
                          ? "bg-green-500 text-white"
                          : "bg-red-500 text-white"
                        : "bg-secondary text-foreground hover:bg-secondary/80"
                    }`}
                    onClick={() => handleAnswer(index)}
                    disabled={selectedAnswer !== null || isHost}
                    whileTap={{ scale: 0.98 }}
                  >
                    {option.text}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Live Leaderboard */}
            <div className="tg-section p-4">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Crown className="w-4 h-4 text-yellow-500" />
                Лидерборд
              </h3>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {participants.slice(0, 5).map((p: any, i: number) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-muted-foreground w-4">{i + 1}</span>
                      <span className="text-foreground text-sm">
                        {p.profiles?.first_name || `Player ${i + 1}`}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-primary">{p.score} pts</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Host controls */}
            {isHost && (
              <button className="tg-button w-full" onClick={handleNextQuestion}>
                {(liveQuiz as any)?.current_question >= questions.length - 1
                  ? "Завершить квиз"
                  : "Следующий вопрос"}
              </button>
            )}

            {/* Reaction bar */}
            <div className="flex gap-2 justify-center flex-wrap">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center text-xl hover:scale-110 transition-transform"
                  onClick={() => handleSendReaction(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Finished */}
        {isFinished && (
          <motion.div
            className="tg-section p-6 text-center"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Crown className="w-8 h-8 text-yellow-500" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-4">Квиз завершён!</h2>

            {/* Final Leaderboard */}
            <div className="space-y-3 mb-6">
              {participants.slice(0, 3).map((p: any, i: number) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-3 rounded-xl ${
                    i === 0 ? "bg-yellow-500/10" : i === 1 ? "bg-gray-400/10" : "bg-amber-600/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                    <span className="font-medium text-foreground">
                      {p.profiles?.first_name || `Player ${i + 1}`}
                    </span>
                  </div>
                  <span className="font-bold text-primary">{p.score} pts</span>
                </div>
              ))}
            </div>

            <button className="tg-button w-full" onClick={handleBack}>
              Вернуться
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
