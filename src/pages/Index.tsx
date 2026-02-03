import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BannerCarousel } from "@/components/BannerCarousel";
import { QuizShowcase } from "@/components/QuizShowcase";
import { BottomNav } from "@/components/BottomNav";
import { TasksBlock } from "@/components/TasksBlock";
import { OnboardingCarousel } from "@/components/OnboardingCarousel";
import { useBanners } from "@/hooks/useBanners";
import { usePublishedQuizzes, useQuizWithQuestions } from "@/hooks/useQuizzes";
import { useFavoriteIds, useToggleFavorite } from "@/hooks/useFavorites";
import { useLikeIds, useToggleLike } from "@/hooks/useLikes";
import { useUserStats } from "@/hooks/useUserStats";
import { useEnsureProfile } from "@/hooks/useCurrentProfile";
import { useTrackEvent } from "@/hooks/useTrackEvent";
import { QuizScreen } from "@/screens/QuizScreen";
import { ResultScreen } from "@/screens/ResultScreen";
import { CompareScreen } from "@/screens/CompareScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { AdminPanel } from "@/screens/AdminPanel";
import { LeaderboardScreen } from "@/screens/LeaderboardScreen";
import { CreateQuizScreen } from "@/screens/CreateQuizScreen";
import { CreatorsScreen } from "@/screens/CreatorsScreen";
import { PvpLobbyScreen } from "@/screens/PvpLobbyScreen";
import { PersonalityTestScreen } from "@/screens/PersonalityTestScreen";
import { PersonalityTestResultScreen } from "@/screens/PersonalityTestResultScreen";
import { CreatePersonalityTestScreen } from "@/screens/CreatePersonalityTestScreen";
import { PersonalityTestCard } from "@/components/PersonalityTestCard";
import {
  usePublishedPersonalityTests,
  usePersonalityTestLikeIds,
  usePersonalityTestFavoriteIds,
  useTogglePersonalityTestLike,
  useTogglePersonalityTestFavorite,
  PersonalityTestResult
} from "@/hooks/usePersonalityTests";
import { toast } from "@/hooks/use-toast";
import { UserStats, QuizResult } from "@/types/quiz";
import { initTelegramApp, backButton, isTelegramWebApp, shareResult, getTelegramUserData, getTelegram } from "@/lib/telegram";
import { calculateResult } from "@/data/quizData";
import { TrendingUp, Sparkles, Search, X, Swords } from "lucide-react";
import { PopcornIcon } from "@/components/icons/PopcornIcon";
import { BookmarkIcon } from "@/components/icons/BookmarkIcon";
import { Input } from "@/components/ui/input";
import { haptic } from "@/lib/telegram";

type AppScreen = "home" | "quiz" | "result" | "compare" | "profile" | "admin" | "leaderboard" | "create" | "gallery" | "pvp" | "personality_test" | "personality_result" | "create_test";
type TabId = "home" | "gallery" | "create" | "leaderboard" | "profile";
type QuizTab = "trending" | "all";
type ContentType = "quizzes" | "tests";
type SortType = "popular" | "saves" | "newest";


const Index = () => {
  const { data: banners = [], isLoading: bannersLoading } = useBanners();
  const { data: quizzes = [], isLoading: quizzesLoading } = usePublishedQuizzes();
  const { data: saveIds = new Set() } = useFavoriteIds();
  const { data: likeIds = new Set() } = useLikeIds();
  const toggleSave = useToggleFavorite();
  const toggleLike = useToggleLike();

  // Personality tests hooks
  const { data: personalityTests = [], isLoading: testsLoading } = usePublishedPersonalityTests();
  const { data: testLikeIds = new Set() } = usePersonalityTestLikeIds();
  const { data: testSaveIds = new Set() } = usePersonalityTestFavoriteIds();
  const toggleTestLike = useTogglePersonalityTestLike();
  const toggleTestSave = useTogglePersonalityTestFavorite();

  const [currentScreen, setCurrentScreen] = useState<AppScreen>("home");
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);

  // Personality test state
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<PersonalityTestResult | null>(null);
  const [testResultTitle, setTestResultTitle] = useState("");
  const [testResultTestId, setTestResultTestId] = useState("");
  const [contentType, setContentType] = useState<ContentType>("quizzes");

  const [quizTab, setQuizTab] = useState<QuizTab>("trending");
  const [sortBy, setSortBy] = useState<SortType>("popular");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const { data: quizData } = useQuizWithQuestions(selectedQuizId);

  // Profile and tracking
  const ensureProfile = useEnsureProfile();
  const { track, trackScreen } = useTrackEvent();
  const profileInitialized = useRef(false);

  useEffect(() => {
    const onboardingCompleted = localStorage.getItem("onboarding_completed");
    if (!onboardingCompleted) {
      setShowOnboarding(true);
    }
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem("onboarding_completed", "true");
    setShowOnboarding(false);
    haptic.notification('success');
  };

  // Initialize app: Telegram + Profile + Tracking
  useEffect(() => {
    const init = async () => {
      // 1. Initialize Telegram WebApp
      initTelegramApp();

      // 2. Log Telegram user data
      const userData = getTelegramUserData();
      if (userData) {
        console.log("Telegram user data:", userData);
      }

      // 3. Ensure profile exists (creates or updates)
      if (!profileInitialized.current && isTelegramWebApp()) {
        profileInitialized.current = true;
        try {
          await ensureProfile.mutateAsync();
          console.log("Profile initialized");
        } catch (e) {
          console.error("Profile initialization failed:", e);
        }
      }

      // 4. Track app open
      track('app_open', {
        source: userData ? 'telegram' : 'web',
        referrer: document.referrer || null,
      });

      // 5. Handle deep link start_param (delay to allow data to load)
      const tg = getTelegram();
      const startParam = tg?.initDataUnsafe?.start_param;
      if (startParam) {
        console.log("Deep link start_param:", startParam);

        // Parse start_param format: test_UUID_ref_userId_src_source or quest_UUID_ref_userId_src_source
        // Extract UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
        const uuidMatch = startParam.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
        const isTest = startParam.startsWith('test_');
        const isQuest = startParam.startsWith('quest_');

        if (uuidMatch) {
          const id = uuidMatch[1];

          // Delay screen change to allow React to render first
          setTimeout(() => {
            if (isTest) {
              console.log("Opening personality test:", id);
              setSelectedTestId(id);
              setCurrentScreen("personality_test");
            } else if (isQuest) {
              console.log("Opening quiz:", id);
              setSelectedQuizId(id);
              setCurrentScreen("quiz");
            } else {
              // Legacy format or unknown - try to determine by checking if it exists
              // For now, default to quiz
              console.log("Opening content (legacy format):", id);
              setSelectedQuizId(id);
              setCurrentScreen("quiz");
            }
          }, 100);
        }
      }
    };
    init();
  }, []);

  // Track screen changes
  useEffect(() => {
    trackScreen(currentScreen);
  }, [currentScreen, trackScreen]);

  useEffect(() => {
    if (!isTelegramWebApp()) return;

    if (currentScreen !== "home") {
      backButton.show(() => {
        if (currentScreen === "quiz") {
          setCurrentScreen("home");
          setSelectedQuizId(null);
          setCurrentQuestion(0);
          setAnswers([]);
        } else if (currentScreen === "compare") {
          setCurrentScreen("result");
        } else if (currentScreen === "admin") {
          setCurrentScreen("profile");
        } else if (currentScreen === "result") {
          setCurrentScreen("home");
          setSelectedQuizId(null);
          setResult(null);
        } else if (currentScreen === "pvp") {
          setCurrentScreen("home");
          setActiveTab("home");
        } else {
          setCurrentScreen("home");
          setActiveTab("home");
        }
      });
    } else {
      backButton.hide();
    }

    return () => {
      backButton.hide();
    };
  }, [currentScreen, result]);

  const handleTabChange = (tab: TabId) => {
    if (tab === "create") {
      setCurrentScreen("create");
    } else if (tab === "leaderboard") {
      setCurrentScreen("leaderboard");
    } else if (tab === "profile") {
      setCurrentScreen("profile");
    } else if (tab === "gallery") {
      setCurrentScreen("gallery");
    } else {
      setCurrentScreen("home");
    }
    setActiveTab(tab);
  };

  // Track quiz start time for duration calculation
  const quizStartTime = useRef<number>(Date.now());
  const questionStartTime = useRef<number>(Date.now());

  const handleQuizSelect = (quizId: string) => {
    haptic.impact('medium');
    setSelectedQuizId(quizId);
    setCurrentQuestion(0);
    setAnswers([]);
    setCurrentScreen("quiz");

    // Track quiz start
    quizStartTime.current = Date.now();
    questionStartTime.current = Date.now();
    track('quiz_start', { quiz_id: quizId }, quizId);
  };

  const handleAnswer = (answerIndex: number) => {
    const questions = quizData?.questions || [];
    const totalQuestions = questions.length > 0 ? questions.length : 5;

    // Track answer time
    const answerTimeMs = Date.now() - questionStartTime.current;
    const correctAnswer = questions[currentQuestion]?.correct_answer;
    const isCorrect = answerIndex === correctAnswer;

    // Track this answer
    track('quiz_answer', {
      question_index: currentQuestion,
      answer_index: answerIndex,
      is_correct: isCorrect,
      time_ms: answerTimeMs,
    }, selectedQuizId || undefined);

    const newAnswers = [...answers, answerIndex];
    setAnswers(newAnswers);

    if (currentQuestion < totalQuestions - 1) {
      setTimeout(() => {
        setCurrentQuestion((prev) => prev + 1);
        questionStartTime.current = Date.now(); // Reset for next question
      }, 300);
    } else {
      setTimeout(() => {
        const quizResult = calculateResult(newAnswers);
        setResult(quizResult);
        setCurrentScreen("result");

        // Track quiz completion
        const totalTimeMs = Date.now() - quizStartTime.current;
        track('quiz_complete', {
          score: quizResult.score,
          max_score: 100,
          time_total_ms: totalTimeMs,
          percentile: quizResult.percentile,
        }, selectedQuizId || undefined);
      }, 500);
    }
  };

  const handleShare = () => {
    if (result) {
      shareResult(result.score, result.percentile, result.verdict);
      // Track share event
      track('quiz_share', { share_type: 'inline' }, selectedQuizId || undefined);
    }
  };

  const handleChallenge = () => {
    setCurrentScreen("compare");
  };

  const handleRestart = () => {
    setCurrentQuestion(0);
    setAnswers([]);
    setResult(null);
    setCurrentScreen("quiz");
  };

  const handleToggleSave = (quizId: string) => {
    const isSaved = saveIds.has(quizId);
    toggleSave.mutate({ quizId, isFavorite: isSaved });
  };

  const handleToggleLike = (quizId: string) => {
    const isLiked = likeIds.has(quizId);
    toggleLike.mutate({ quizId, isLiked });
  };

  // Personality test handlers
  const handleTestSelect = (testId: string) => {
    haptic.impact('light');
    setSelectedTestId(testId);
    setCurrentScreen("personality_test");
  };

  const handleTestComplete = (result: PersonalityTestResult, testTitle: string, testId: string) => {
    setTestResult(result);
    setTestResultTitle(testTitle);
    setTestResultTestId(testId);
    setCurrentScreen("personality_result");
  };

  const handleToggleTestLike = (testId: string) => {
    const isLiked = testLikeIds.has(testId);
    toggleTestLike.mutate({ testId, isLiked });
  };

  const handleToggleTestSave = (testId: string) => {
    const isSaved = testSaveIds.has(testId);
    toggleTestSave.mutate({ testId, isFavorite: isSaved });
  };

  // Fetch real user stats from database
  const { data: fetchedStats } = useUserStats();

  const userStats: UserStats = {
    bestScore: fetchedStats?.bestScore ?? result?.score ?? 0,
    testsCompleted: fetchedStats?.testsCompleted ?? 0,
    globalRank: fetchedStats?.globalRank ?? 0,
    activeChallenges: fetchedStats?.activeChallenges ?? 0,
  };

  const filteredQuizzes = quizzes.filter(quiz =>
    quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    quiz.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedQuizzes = [...filteredQuizzes].sort((a, b) => {
    switch (sortBy) {
      case "popular":
        return ((b as any).like_count ?? 0) - ((a as any).like_count ?? 0);
      case "saves":
        return ((b as any).save_count ?? 0) - ((a as any).save_count ?? 0);
      case "newest":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      default:
        return 0;
    }
  });

  const trendingQuizzes = [...quizzes]
    .sort((a, b) => ((b as any).like_count ?? 0) - ((a as any).like_count ?? 0))
    .slice(0, 10);

  // Shuffle questions for quiz (memoized to keep same order during session)
  const mappedQuestions = useMemo(() => {
    if (!quizData?.questions) return [];

    // Fisher-Yates shuffle
    const questions = quizData.questions.map((q, i) => ({
      id: i + 1,
      text: q.question_text,
      options: q.options.map(opt => opt.text),
    }));

    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }

    return questions;
  }, [quizData?.questions, selectedQuizId]); // Re-shuffle when quiz changes

  const showBottomNav = ["home", "gallery", "leaderboard", "profile"].includes(currentScreen);
  const displayQuizzes = quizTab === "trending" ? trendingQuizzes : sortedQuizzes;

  if (showOnboarding) {
    return <OnboardingCarousel onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <div className="max-w-md mx-auto">
        <AnimatePresence mode="wait">
          {currentScreen === "home" && (
            <motion.div
              key="home"
              className="p-4 pb-24 safe-bottom space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Header - Challenge Button (Coming Soon) */}
              <div className="flex items-center gap-2 py-2">
                <button
                  onClick={() => {
                    haptic.impact('light');
                    toast({ title: "Скоро", description: "PvP режим уже в разработке!" });
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-400 text-white font-medium opacity-60 relative"
                >
                  <Swords className="w-5 h-5" />
                  Challenge
                  <span className="absolute -top-1 -right-1 text-[10px] bg-primary px-1.5 py-0.5 rounded-full font-medium">
                    soon
                  </span>
                </button>
              </div>

              {/* Banner Carousel */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                {!bannersLoading && banners.length > 0 ? (
                  <BannerCarousel banners={banners} />
                ) : (
                  <div className="tg-section p-4 text-center rounded-2xl" style={{ aspectRatio: "16/7" }}>
                    <div className="flex flex-col items-center justify-center h-full">
                      <Sparkles className="w-6 h-6 text-primary mb-2" />
                      <p className="text-sm text-muted-foreground">Start your first quiz!</p>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Tasks Block */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.12 }}
              >
                <TasksBlock />
              </motion.div>

              {/* Content Type Tabs: Quizzes / Tests */}
              <motion.div
                className="flex gap-2"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.14 }}
              >
                <button
                  className={`flex-1 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${contentType === "quizzes"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground"
                    }`}
                  onClick={() => {
                    haptic.selection();
                    setContentType("quizzes");
                  }}
                >
                  <TrendingUp className="w-4 h-4" />
                  Квизы
                </button>
                <button
                  className={`flex-1 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${contentType === "tests"
                    ? "bg-purple-500 text-white"
                    : "bg-secondary text-foreground"
                    }`}
                  onClick={() => {
                    haptic.selection();
                    setContentType("tests");
                  }}
                >
                  <Sparkles className="w-4 h-4" />
                  Тесты
                </button>
              </motion.div>

              {/* Sort chips + Search button (only for quizzes) */}
              {contentType === "quizzes" && (
                <motion.div
                  className="space-y-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <AnimatePresence>
                    {searchOpen && (
                      <motion.div
                        className="flex gap-2"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                      >
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder="Поиск..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-secondary border-0"
                            autoFocus
                          />
                        </div>
                        <button
                          className="p-2.5 bg-secondary rounded-lg"
                          onClick={() => {
                            setSearchOpen(false);
                            setSearchQuery("");
                          }}
                        >
                          <X className="w-4 h-4 text-foreground" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {(["popular", "saves", "newest"] as const).map((sort) => (
                      <button
                        key={sort}
                        onClick={() => {
                          haptic.selection();
                          setSortBy(sort);
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${sortBy === sort
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground"
                          }`}
                      >
                        {sort === "popular" && <><PopcornIcon className="w-3 h-3" /> Лайки</>}
                        {sort === "saves" && <><BookmarkIcon className="w-3 h-3" /> Saves</>}
                        {sort === "newest" && "✨ Новые"}
                      </button>
                    ))}

                    {!searchOpen && (
                      <button
                        onClick={() => {
                          haptic.selection();
                          setSearchOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-secondary text-muted-foreground flex items-center gap-1"
                      >
                        <Search className="w-3 h-3" />
                        Поиск
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Content List */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.16 }}
              >
                {contentType === "quizzes" ? (
                  // Quizzes List
                  <>
                    {!quizzesLoading && displayQuizzes.length === 0 ? (
                      <div className="tg-section p-6 text-center">
                        <Sparkles className="w-10 h-10 text-primary mx-auto mb-3" />
                        <h3 className="font-semibold text-foreground mb-2">
                          {searchQuery ? "Ничего не найдено" : "Нет квизов"}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {searchQuery
                            ? "Попробуй изменить поисковый запрос"
                            : "Стань первым создателем квиза!"}
                        </p>
                        {!searchQuery && (
                          <button
                            className="tg-button"
                            onClick={() => {
                              haptic.impact('medium');
                              setCurrentScreen("create");
                            }}
                          >
                            Создать квиз
                          </button>
                        )}
                      </div>
                    ) : (
                      <QuizShowcase
                        quizzes={displayQuizzes}
                        isLoading={quizzesLoading}
                        onQuizSelect={handleQuizSelect}
                        likeIds={likeIds}
                        saveIds={saveIds}
                        onToggleLike={handleToggleLike}
                        onToggleSave={handleToggleSave}
                      />
                    )}
                  </>
                ) : (
                  // Personality Tests List
                  <>
                    {!testsLoading && personalityTests.length === 0 ? (
                      <div className="tg-section p-6 text-center">
                        <Sparkles className="w-10 h-10 text-purple-500 mx-auto mb-3" />
                        <h3 className="font-semibold text-foreground mb-2">Нет тестов</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Создай первый тест личности!
                        </p>
                        <button
                          className="tg-button bg-purple-500 hover:bg-purple-600"
                          onClick={() => {
                            haptic.impact('medium');
                            setCurrentScreen("create_test");
                          }}
                        >
                          Создать тест
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {personalityTests.map((test, index) => (
                          <motion.div
                            key={test.id}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <PersonalityTestCard
                              id={test.id}
                              title={test.title}
                              description={test.description || undefined}
                              image_url={test.image_url || undefined}
                              participant_count={test.participant_count}
                              question_count={test.question_count}
                              result_count={test.result_count}
                              like_count={test.like_count}
                              save_count={test.save_count}
                              isLiked={testLikeIds.has(test.id)}
                              isSaved={testSaveIds.has(test.id)}
                              onClick={() => handleTestSelect(test.id)}
                              onToggleLike={() => handleToggleTestLike(test.id)}
                              onToggleSave={() => handleToggleTestSave(test.id)}
                            />
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            </motion.div>
          )}

          {currentScreen === "pvp" && (
            <PvpLobbyScreen
              key="pvp"
              onBack={() => {
                setCurrentScreen("home");
                setActiveTab("home");
              }}
              onStartGame={(roomId, quizId) => {
                console.log("Starting PvP game:", roomId, quizId);
              }}
            />
          )}

          {currentScreen === "gallery" && (
            <CreatorsScreen
              key="gallery"
              onBack={() => {
                setCurrentScreen("home");
                setActiveTab("home");
              }}
            />
          )}

          {currentScreen === "quiz" && (
            <QuizScreen
              key="quiz"
              questions={mappedQuestions.length > 0 ? mappedQuestions : undefined}
              currentQuestion={currentQuestion}
              onAnswer={handleAnswer}
            />
          )}

          {currentScreen === "personality_test" && selectedTestId && (
            <PersonalityTestScreen
              key="personality_test"
              testId={selectedTestId}
              onBack={() => {
                setCurrentScreen("home");
                setSelectedTestId(null);
              }}
              onComplete={handleTestComplete}
            />
          )}

          {currentScreen === "personality_result" && testResult && (
            <PersonalityTestResultScreen
              key="personality_result"
              result={testResult}
              testTitle={testResultTitle}
              testId={testResultTestId}
              onHome={() => {
                setCurrentScreen("home");
                setSelectedTestId(null);
                setTestResult(null);
              }}
              onRetry={() => {
                setCurrentScreen("personality_test");
              }}
              onChallenge={() => {
                toast({ title: "Функция в разработке" });
              }}
            />
          )}

          {currentScreen === "create_test" && (
            <CreatePersonalityTestScreen
              key="create_test"
              onBack={() => setCurrentScreen("home")}
              onSuccess={() => {
                setCurrentScreen("home");
                setContentType("tests");
              }}
            />
          )}

          {currentScreen === "result" && result && (
            <ResultScreen
              key="result"
              result={result}
              quizId={selectedQuizId || undefined}
              quizTitle={quizData?.title}
              onShare={handleShare}
              onChallenge={handleChallenge}
              onRestart={handleRestart}
              onNavigate={(screen) => setCurrentScreen(screen as AppScreen)}
              onHome={() => {
                setCurrentScreen("home");
                setSelectedQuizId(null);
                setCurrentQuestion(0);
                setAnswers([]);
                setResult(null);
              }}
            />
          )}

          {currentScreen === "compare" && result && (
            <CompareScreen
              key="compare"
              userResult={result}
              onInvite={() => toast({ title: "Invite sent!" })}
              onPostComparison={() => toast({ title: "Posted!" })}
              onBack={() => setCurrentScreen("result")}
            />
          )}

          {currentScreen === "profile" && (
            <ProfileScreen
              key="profile"
              stats={userStats}
              onBack={() => {
                setCurrentScreen("home");
                setActiveTab("home");
              }}
              onOpenAdmin={() => setCurrentScreen("admin")}
              onQuizSelect={handleQuizSelect}
            />
          )}

          {currentScreen === "admin" && (
            <AdminPanel
              key="admin"
              onBack={() => setCurrentScreen("profile")}
            />
          )}

          {currentScreen === "leaderboard" && (
            <LeaderboardScreen
              key="leaderboard"
              onBack={() => {
                setCurrentScreen("home");
                setActiveTab("home");
              }}
            />
          )}

          {currentScreen === "create" && (
            <CreateQuizScreen
              key="create"
              onBack={() => {
                setCurrentScreen("home");
                setActiveTab("home");
              }}
              onSuccess={() => {
                setCurrentScreen("profile");
                setActiveTab("profile");
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {showBottomNav && (
        <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
      )}
    </div>
  );
};

export default Index;
