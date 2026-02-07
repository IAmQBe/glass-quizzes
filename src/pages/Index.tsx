import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BannerCarousel } from "@/components/BannerCarousel";
import { QuizShowcase } from "@/components/QuizShowcase";
import { BottomNav } from "@/components/BottomNav";
import { TasksBlock } from "@/components/TasksBlock";
import { OnboardingCarousel } from "@/components/OnboardingCarousel";
import { useBanners } from "@/hooks/useBanners";
import {
  usePublishedQuizzes,
  useMyQuizzes,
  useQuizWithQuestions,
  useCompletedQuizIds,
  useSubmitQuizResult,
} from "@/hooks/useQuizzes";
import { useFavoriteIds, useToggleFavorite } from "@/hooks/useFavorites";
import { useLikeIds, useToggleLike } from "@/hooks/useLikes";
import { useUserStats } from "@/hooks/useUserStats";
import { useCurrentProfile, useEnsureProfile } from "@/hooks/useCurrentProfile";
import { useTrackEvent } from "@/hooks/useTrackEvent";
import { QuizScreen } from "@/screens/QuizScreen";
import { ResultScreen } from "@/screens/ResultScreen";
import { CompareScreen } from "@/screens/CompareScreen";
import { ProfileScreen, type ProfileTabType } from "@/screens/ProfileScreen";
import { AdminPanel } from "@/screens/AdminPanel";
import { LeaderboardScreen } from "@/screens/LeaderboardScreen";
import { CreateQuizScreen, type CreateQuizSuccessPayload } from "@/screens/CreateQuizScreen";
import { CreatorsScreen } from "@/screens/CreatorsScreen";
import { PvpLobbyScreen } from "@/screens/PvpLobbyScreen";
import { PersonalityTestScreen } from "@/screens/PersonalityTestScreen";
import { PersonalityTestResultScreen } from "@/screens/PersonalityTestResultScreen";
import {
  CreatePersonalityTestScreen,
  type CreatePersonalityTestSuccessPayload,
} from "@/screens/CreatePersonalityTestScreen";
import { PersonalityTestCard } from "@/components/PersonalityTestCard";
import {
  usePublishedPersonalityTests,
  usePersonalityTestLikeIds,
  usePersonalityTestFavoriteIds,
  useTogglePersonalityTestLike,
  useTogglePersonalityTestFavorite,
  useCompletedTestIds,
  useMyPersonalityTests,
  usePersonalityTestWithDetails,
  PersonalityTestResult
} from "@/hooks/usePersonalityTests";
import { toast } from "@/hooks/use-toast";
import { UserStats, QuizResult } from "@/types/quiz";
import {
  initTelegramApp,
  backButton,
  isTelegramWebApp,
  shareResult,
  shareQuizInvite,
  sharePersonalityTestInvite,
  getTelegramUserData,
  getTelegram,
} from "@/lib/telegram";
import { initUser } from "@/lib/user";
import { calculateResult, getVerdict } from "@/data/quizData";
import { TrendingUp, Sparkles, Search, X, Swords, Users, ArrowDown, ArrowUp } from "lucide-react";
import { PopcornIcon } from "@/components/icons/PopcornIcon";
import { BookmarkIcon } from "@/components/icons/BookmarkIcon";
import { Input } from "@/components/ui/input";
import { ToastAction } from "@/components/ui/toast";
import { haptic } from "@/lib/telegram";
import { SquadScreen } from "@/screens/SquadScreen";
import { SquadListScreen } from "@/screens/SquadListScreen";
import { CreateSquadGuide } from "@/screens/CreateSquadGuide";
import { QuizPreviewScreen } from "@/screens/QuizPreviewScreen";
import { PersonalityTestPreviewScreen } from "@/screens/PersonalityTestPreviewScreen";
import { useMySquad, Squad } from "@/hooks/useSquads";
import { PredictionTopBlock } from "@/components/PredictionTopBlock";
import { PredictionListScreen } from "@/screens/PredictionListScreen";
import { PredictionDetailsScreen } from "@/screens/PredictionDetailsScreen";
import { CreatePredictionScreen } from "@/screens/CreatePredictionScreen";
import { CreatePredictionGateModal } from "@/components/CreatePredictionGateModal";
import { DEMO_PREDICTIONS } from "@/data/predictions";
import { PredictionCreationEligibility, PredictionPoll } from "@/types/prediction";
import {
  usePredictionCreationEligibility,
  usePredictionPolls,
  useSquadPredictionQuota,
} from "@/hooks/usePredictions";
import { useRolePreview } from "@/hooks/useRolePreview";
import { isCurrentUserAdmin } from "@/lib/user";

type AppScreen = "home" | "quiz_preview" | "quiz" | "result" | "compare" | "profile" | "admin" | "leaderboard" | "create" | "gallery" | "pvp" | "test_preview" | "personality_test" | "personality_result" | "create_test" | "squad_list" | "squad_detail" | "create_squad" | "create_select" | "prediction_list" | "prediction_details" | "create_prediction";
type TabId = "home" | "gallery" | "create" | "leaderboard" | "profile";
type ContentType = "quizzes" | "tests";
type SortType = "completed" | "newest" | "popular" | "saves";
type SortDirection = "desc" | "asc";
type PredictionBackTarget = "home" | "prediction_list" | "admin";
type PredictionCreateEntry = "home" | "prediction_list" | "admin";
const HOME_CONTENT_TYPE_STORAGE_KEY = "home_content_type";
const PREDICTION_WARMUP_DONE_KEY = "prediction_warmup_done";

type NavigationSnapshot = {
  screen: AppScreen;
  activeTab: TabId;
  selectedQuizId: string | null;
  selectedTestId: string | null;
  selectedPredictionId: string | null;
  predictionBackTarget: PredictionBackTarget;
  predictionCreateEntry: PredictionCreateEntry;
  selectedSquad: Squad | null;
  contentType: ContentType;
  profileTab: ProfileTabType;
  scrollY: number;
};


const Index = () => {
  const { data: banners = [], isLoading: bannersLoading } = useBanners();
  const { data: quizzes = [], isLoading: quizzesLoading } = usePublishedQuizzes();
  const { data: myQuizzes = [] } = useMyQuizzes();
  const { data: saveIds = new Set() } = useFavoriteIds();
  const { data: likeIds = new Set() } = useLikeIds();
  const { data: completedQuizIds = new Set() } = useCompletedQuizIds();
  const submitQuizResult = useSubmitQuizResult();
  const toggleSave = useToggleFavorite();
  const toggleLike = useToggleLike();

  // Personality tests hooks
  const { data: personalityTests = [], isLoading: testsLoading } = usePublishedPersonalityTests();
  const { data: myPersonalityTests = [] } = useMyPersonalityTests();
  const { data: testLikeIds = new Set() } = usePersonalityTestLikeIds();
  const { data: testSaveIds = new Set() } = usePersonalityTestFavoriteIds();
  const { data: completedTestIds = new Set() } = useCompletedTestIds();
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
  const [contentType, setContentType] = useState<ContentType>(() => {
    if (typeof window === "undefined") return "quizzes";
    const stored = window.localStorage.getItem(HOME_CONTENT_TYPE_STORAGE_KEY);
    return stored === "tests" ? "tests" : "quizzes";
  });
  const [profileTab, setProfileTab] = useState<ProfileTabType>("my");

  // Squad state
  const [selectedSquad, setSelectedSquad] = useState<Squad | null>(null);
  const { data: currentProfile } = useCurrentProfile();
  const { data: mySquad } = useMySquad();

  // Prediction market state
  const [predictions, setPredictions] = useState<PredictionPoll[]>(DEMO_PREDICTIONS);
  const [selectedPredictionId, setSelectedPredictionId] = useState<string | null>(null);
  const [predictionBackTarget, setPredictionBackTarget] = useState<PredictionBackTarget>("prediction_list");
  const [predictionCreateEntry, setPredictionCreateEntry] = useState<PredictionCreateEntry>("home");
  const [isCreateGateOpen, setIsCreateGateOpen] = useState(false);
  const [gateEligibility, setGateEligibility] = useState<PredictionCreationEligibility | null>(null);

  const { data: predictionPolls = [], refetch: refetchPredictionPolls } = usePredictionPolls();
  const {
    data: predictionEligibility,
    refetch: refetchPredictionEligibility,
    isFetching: isPredictionEligibilityLoading,
  } = usePredictionCreationEligibility();
  const { rolePreviewMode, setRolePreviewMode, forcedRole } = useRolePreview();
  const { data: predictionQuota } = useSquadPredictionQuota(
    predictionEligibility?.squad_id || gateEligibility?.squad_id || mySquad?.id,
    Boolean(predictionEligibility?.squad_id || gateEligibility?.squad_id || mySquad?.id)
  );

  const [sortBy, setSortBy] = useState<SortType>("completed");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [shouldScrollToContentBlock, setShouldScrollToContentBlock] = useState(false);
  const homeContentBlockRef = useRef<HTMLDivElement | null>(null);
  const currentScrollYRef = useRef(0);
  const navigationStackRef = useRef<NavigationSnapshot[]>([]);
  const previousSnapshotRef = useRef<NavigationSnapshot | null>(null);
  const isNavigatingBackRef = useRef(false);
  const historyIndexRef = useRef(0);
  const lastBackRequestAtRef = useRef(0);

  const { data: quizData } = useQuizWithQuestions(selectedQuizId);
  const { data: selectedTestDetails } = usePersonalityTestWithDetails(selectedTestId);

  // Profile and tracking
  const ensureProfile = useEnsureProfile();
  const { track, trackScreen } = useTrackEvent();
  const profileInitialized = useRef(false);
  const quizStartTime = useRef<number>(Date.now());
  const testStartTime = useRef<number>(Date.now());
  const questionStartTime = useRef<number>(Date.now());
  const quizCompletedRef = useRef(false);

  useEffect(() => {
    if (predictionPolls.length > 0) {
      setPredictions(predictionPolls);
    }
  }, [predictionPolls]);

  useEffect(() => {
    if (!shouldScrollToContentBlock || currentScreen !== "home") return;

    const timeoutId = window.setTimeout(() => {
      homeContentBlockRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setShouldScrollToContentBlock(false);
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [shouldScrollToContentBlock, currentScreen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(HOME_CONTENT_TYPE_STORAGE_KEY, contentType);
  }, [contentType]);

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
          const authReady = await initUser();
          if (!authReady) {
            console.warn("Supabase auth session init failed");
          }
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

        const pollMatch = startParam.match(/poll(?:=|:|_)([a-z0-9-]+)/i);
        if (pollMatch) {
          const predictionId = pollMatch[1];
          track("deep_link_open", {
            start_param: startParam,
            deep_link_type: "prediction_poll",
            content_id: predictionId,
            source: "telegram_start_param",
          });
          setTimeout(() => {
            setSelectedPredictionId(predictionId);
            setPredictionBackTarget("home");
            setCurrentScreen("prediction_details");
          }, 100);
          return;
        }

        // Parse start_param format: test_UUID_ref_userId_src_source or quest_UUID_ref_userId_src_source
        // Extract UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
        const uuidMatch = startParam.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
        const isTest = startParam.startsWith('test_');
        const isQuest = startParam.startsWith('quest_');

        if (uuidMatch) {
          const id = uuidMatch[1];
          track("deep_link_open", {
            start_param: startParam,
            deep_link_type: isTest ? "personality_test" : isQuest ? "quiz" : "legacy_quiz",
            content_id: id,
            source: "telegram_start_param",
          });

          // Delay screen change to allow React to render first
          setTimeout(() => {
            if (isTest) {
              console.log("Opening personality test:", id);
              track("test_view", { test_id: id });
              setSelectedTestId(id);
              setCurrentScreen("test_preview");
            } else if (isQuest) {
              console.log("Opening quiz:", id);
              track("quiz_view", { quiz_id: id }, id);
              setSelectedQuizId(id);
              setCurrentScreen("quiz_preview");
            } else {
              // Legacy format or unknown - try to determine by checking if it exists
              // For now, default to quiz
              console.log("Opening content (legacy format):", id);
              track("quiz_view", { quiz_id: id }, id);
              setSelectedQuizId(id);
              setCurrentScreen("quiz_preview");
            }
          }, 100);
        } else {
          track("deep_link_open", {
            start_param: startParam,
            deep_link_type: "unknown",
            source: "telegram_start_param",
          });
        }
      }
    };
    init();
  }, []);

  // Track screen changes
  useEffect(() => {
    trackScreen(currentScreen);
  }, [currentScreen, trackScreen]);

  const trackQuizAbandon = useCallback(
    (reason: string) => {
      if (currentScreen !== "quiz" || !selectedQuizId || quizCompletedRef.current) return;

      const timeSpentMs = Math.max(0, Date.now() - quizStartTime.current);
      track(
        "quiz_abandon",
        {
          quiz_id: selectedQuizId,
          question_index: currentQuestion,
          time_ms: timeSpentMs,
          reason,
        },
        selectedQuizId
      );
      quizCompletedRef.current = true;
    },
    [currentQuestion, currentScreen, selectedQuizId, track]
  );

  const buildNavigationSnapshot = useCallback(
    (): NavigationSnapshot => ({
      screen: currentScreen,
      activeTab,
      selectedQuizId,
      selectedTestId,
      selectedPredictionId,
      predictionBackTarget,
      predictionCreateEntry,
      selectedSquad,
      contentType,
      profileTab,
      scrollY: currentScrollYRef.current,
    }),
    [
      activeTab,
      contentType,
      currentScreen,
      predictionBackTarget,
      predictionCreateEntry,
      profileTab,
      selectedPredictionId,
      selectedQuizId,
      selectedSquad,
      selectedTestId,
    ]
  );

  const restoreScrollPosition = useCallback((scrollY: number) => {
    if (typeof window === "undefined") return;
    const safeScrollY = Number.isFinite(scrollY) ? Math.max(0, scrollY) : 0;
    [0, 80, 220].forEach((delayMs) => {
      window.setTimeout(() => {
        window.scrollTo({ top: safeScrollY, behavior: "auto" });
      }, delayMs);
    });
  }, []);

  const restoreNavigationSnapshot = useCallback(
    (snapshot: NavigationSnapshot) => {
      setCurrentScreen(snapshot.screen);
      setActiveTab(snapshot.activeTab);
      setSelectedQuizId(snapshot.selectedQuizId);
      setSelectedTestId(snapshot.selectedTestId);
      setSelectedPredictionId(snapshot.selectedPredictionId);
      setPredictionBackTarget(snapshot.predictionBackTarget);
      setPredictionCreateEntry(snapshot.predictionCreateEntry);
      setSelectedSquad(snapshot.selectedSquad);
      setContentType(snapshot.contentType);
      setProfileTab(snapshot.profileTab);
      setShouldScrollToContentBlock(false);
      restoreScrollPosition(snapshot.scrollY);
    },
    [restoreScrollPosition]
  );

  const handleBackNavigation = useCallback(() => {
    if (currentScreen === "quiz") {
      trackQuizAbandon("back_button");
      setCurrentQuestion(0);
      setAnswers([]);
    }

    if (currentScreen === "result") {
      setResult(null);
    }

    const previousSnapshot = navigationStackRef.current.pop();

    if (!previousSnapshot) {
      // If history is missing (for example, first screen), fall back to the current bottom tab.
      // This prevents "Back" from always dumping the user on Home.
      const fallbackScreen: AppScreen = activeTab === "profile"
        ? "profile"
        : activeTab === "leaderboard"
          ? "leaderboard"
          : activeTab === "gallery"
            ? "gallery"
            : activeTab === "create"
              ? "create_select"
              : "home";

      setCurrentScreen(fallbackScreen);
      setActiveTab(activeTab);
      setShouldScrollToContentBlock(false);
      restoreScrollPosition(currentScrollYRef.current);
      return;
    }

    isNavigatingBackRef.current = true;
    restoreNavigationSnapshot(previousSnapshot);
  }, [activeTab, currentScreen, restoreNavigationSnapshot, restoreScrollPosition, trackQuizAbandon]);

  const requestBack = useCallback(() => {
    const now = Date.now();
    if (now - lastBackRequestAtRef.current < 350) return;
    lastBackRequestAtRef.current = now;

    if (typeof window === "undefined") {
      handleBackNavigation();
      return;
    }

    if (historyIndexRef.current > 0) {
      window.history.back();
      return;
    }

    handleBackNavigation();
  }, [handleBackNavigation]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncWindowScroll = () => {
      currentScrollYRef.current = window.scrollY || window.pageYOffset || 0;
      if (previousSnapshotRef.current) {
        previousSnapshotRef.current.scrollY = currentScrollYRef.current;
      }
    };

    syncWindowScroll();
    window.addEventListener("scroll", syncWindowScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", syncWindowScroll);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Initialize history state for reliable hardware/browser back handling.
    try {
      const state = window.history.state as any;
      if (state && state.__glass_quizzes_nav === true && typeof state.idx === "number") {
        historyIndexRef.current = Math.max(0, state.idx);
      } else {
        historyIndexRef.current = 0;
        window.history.replaceState({ __glass_quizzes_nav: true, idx: 0 }, "");
      }
    } catch {
      // Ignore history errors; app will still work with the internal stack.
    }

    const onPopState = (event: PopStateEvent) => {
      const state = event.state as any;
      if (state && state.__glass_quizzes_nav === true) {
        historyIndexRef.current = typeof state.idx === "number"
          ? Math.max(0, state.idx)
          : Math.max(0, historyIndexRef.current - 1);
        handleBackNavigation();
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [handleBackNavigation]);

  useEffect(() => {
    const snapshot = buildNavigationSnapshot();
    const previousSnapshot = previousSnapshotRef.current;

    if (!previousSnapshot) {
      previousSnapshotRef.current = snapshot;
      return;
    }

    if (previousSnapshot.screen !== snapshot.screen) {
      if (isNavigatingBackRef.current) {
        isNavigatingBackRef.current = false;
      } else {
        navigationStackRef.current.push(previousSnapshot);
        if (navigationStackRef.current.length > 80) {
          navigationStackRef.current.shift();
        }

        // Mirror forward navigation in browser history so hardware/back gestures work.
        if (typeof window !== "undefined") {
          try {
            const nextIdx = historyIndexRef.current + 1;
            historyIndexRef.current = nextIdx;
            window.history.pushState({ __glass_quizzes_nav: true, idx: nextIdx }, "");
          } catch {
            // Best-effort; internal stack still provides back navigation.
          }
        }
      }
    }

    previousSnapshotRef.current = snapshot;
  }, [buildNavigationSnapshot]);

  useEffect(() => {
    if (!isTelegramWebApp()) return;

    if (currentScreen !== "home") {
      backButton.show(() => {
        requestBack();
      });
    } else {
      backButton.hide();
    }

    return () => {
      backButton.hide();
    };
  }, [currentScreen, requestBack]);

  const handleTabChange = (tab: TabId) => {
    if (currentScreen === "quiz") {
      trackQuizAbandon("tab_change");
    }

    if (tab === "create") {
      setCurrentScreen("create_select");
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

  const persistQuizCompletion = (quizId: string | null, quizResult: QuizResult, answerList: number[]) => {
    if (!quizId) return;

    submitQuizResult.mutate({
      quiz_id: quizId,
      score: quizResult.score,
      max_score: quizResult.maxScore,
      percentile: quizResult.percentile,
      answers: answerList,
    });
  };

  const handleQuizSelect = (quizId: string) => {
    haptic.impact('medium');
    track("quiz_view", { quiz_id: quizId }, quizId);
    setSelectedQuizId(quizId);
    setCurrentQuestion(0);
    setAnswers([]);
    setCurrentScreen("quiz_preview");
  };

  const handleStartQuiz = () => {
    haptic.impact('medium');
    setCurrentScreen("quiz");
    // Track quiz start
    quizStartTime.current = Date.now();
    questionStartTime.current = Date.now();
    quizCompletedRef.current = false;
    if (selectedQuizId) {
      track('quiz_start', { quiz_id: selectedQuizId }, selectedQuizId);
    }
  };

  const handleAnswer = (answerIndex: number) => {
    const totalQuestions = mappedQuestions.length > 0
      ? mappedQuestions.length
      : (quizData?.questions?.length || 5);

    // Track answer time
    const answerTimeMs = Date.now() - questionStartTime.current;
    const correctAnswer = mappedQuestions[currentQuestion]?.correctAnswer
      ?? quizData?.questions?.[currentQuestion]?.correct_answer;
    const isCorrect = typeof correctAnswer === "number" ? answerIndex === correctAnswer : false;

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
        const quizResult = computeQuizResult(newAnswers);
        quizCompletedRef.current = true;
        setResult(quizResult);
        setCurrentScreen("result");
        persistQuizCompletion(selectedQuizId, quizResult, newAnswers);
        try {
          window.localStorage.setItem(PREDICTION_WARMUP_DONE_KEY, "true");
        } catch {
          // ignore
        }

        // Track quiz completion
        const totalTimeMs = Date.now() - quizStartTime.current;
        track('quiz_complete', {
          score: quizResult.score,
          max_score: quizResult.maxScore,
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
    track("test_view", { test_id: testId });
    setSelectedTestId(testId);
    setCurrentScreen("test_preview");
  };

  const handleStartTest = () => {
    haptic.impact('medium');
    testStartTime.current = Date.now();
    if (selectedTestId) {
      track("test_start", { test_id: selectedTestId });
    }
    setCurrentScreen("personality_test");
  };

  const handleTestComplete = (result: PersonalityTestResult, testTitle: string, testId: string) => {
    const totalTimeMs = Math.max(0, Date.now() - testStartTime.current);
    track("test_complete", {
      test_id: testId,
      test_title: testTitle,
      result_id: result.id,
      time_total_ms: totalTimeMs,
    });
    setTestResult(result);
    setTestResultTitle(testTitle);
    setTestResultTestId(testId);
    setCurrentScreen("personality_result");
    try {
      window.localStorage.setItem(PREDICTION_WARMUP_DONE_KEY, "true");
    } catch {
      // ignore
    }
  };

  const handleToggleTestLike = (testId: string) => {
    const isLiked = testLikeIds.has(testId);
    toggleTestLike.mutate({ testId, isLiked });
  };

  const handleToggleTestSave = (testId: string) => {
    const isSaved = testSaveIds.has(testId);
    toggleTestSave.mutate({ testId, isFavorite: isSaved });
  };

  const handleQuizCreated = (payload: CreateQuizSuccessPayload) => {
    if (payload.isPendingModeration) {
      setCurrentScreen("profile");
      setActiveTab("profile");
      return;
    }

    setSelectedQuizId(payload.quizId);
    setCurrentQuestion(0);
    setAnswers([]);
    setCurrentScreen("quiz_preview");
    setActiveTab("home");

    toast({
      title: "Квиз опубликован",
      description: "Можно сразу поделиться им с друзьями",
      action: (
        <ToastAction
          altText="Поделиться квизом"
          onClick={() => shareQuizInvite(payload.quizId, payload.title, payload.description)}
        >
          Поделиться
        </ToastAction>
      ),
    });
  };

  const handlePersonalityTestCreated = (payload: CreatePersonalityTestSuccessPayload) => {
    if (payload.isPendingModeration) {
      setCurrentScreen("profile");
      setActiveTab("profile");
      return;
    }

    setSelectedTestId(payload.testId);
    setCurrentScreen("test_preview");
    setActiveTab("home");

    toast({
      title: "Тест опубликован",
      description: "Можно сразу поделиться им с друзьями",
      action: (
        <ToastAction
          altText="Поделиться тестом"
          onClick={() => sharePersonalityTestInvite(payload.testId, payload.title, payload.description)}
        >
          Поделиться
        </ToastAction>
      ),
    });
  };

  // Fetch real user stats from database
  const { data: fetchedStats } = useUserStats();

  const userStats: UserStats = {
    bestScore: fetchedStats?.bestScore ?? result?.score ?? 0,
    testsCompleted: fetchedStats?.testsCompleted ?? 0,
    globalRank: fetchedStats?.globalRank ?? 0,
    activeChallenges: fetchedStats?.activeChallenges ?? 0,
  };

  const fallbackEligibility: PredictionCreationEligibility = {
    eligible: false,
    required_completed_count: 3,
    completed_count: 0,
    has_squad: false,
    squad_id: null,
    squad_title: null,
    is_squad_captain: false,
    is_admin: false,
    monthly_limit: 5,
    used_this_month: 0,
    remaining_this_month: 5,
    cooldown_hours_left: 0,
    next_available_at: null,
    blocking_reason_code: "need_progress",
  };

  const localCompletedCount = completedQuizIds.size + completedTestIds.size;
  const rawEligibility = gateEligibility || predictionEligibility || fallbackEligibility;
  const isAllowlistedPredictionAdmin = forcedRole === "admin"
    ? true
    : forcedRole === "user"
      ? false
      : isCurrentUserAdmin();
  const uiEligibilityForView = useMemo(() => {
    const requiredCompletedCount = Math.max(rawEligibility.required_completed_count || 3, 1);
    const completedCount = Math.max(rawEligibility.completed_count || 0, localCompletedCount);
    const effectiveIsAdmin = forcedRole === "admin"
      ? true
      : forcedRole === "user"
        ? false
        : (rawEligibility.is_admin || isAllowlistedPredictionAdmin);
    const hasSquad = rawEligibility.has_squad || Boolean(rawEligibility.squad_id) || Boolean(mySquad?.id);
    const squadId = rawEligibility.squad_id || mySquad?.id || null;
    const squadTitle = rawEligibility.squad_title || mySquad?.title || null;
    const monthlyLimit = Math.max(rawEligibility.monthly_limit || 5, 1);
    const remaining = Math.max(rawEligibility.remaining_this_month ?? monthlyLimit, 0);
    const cooldownHoursLeft = Math.max(rawEligibility.cooldown_hours_left || 0, 0);

    let blockingReason = rawEligibility.blocking_reason_code;
    if (effectiveIsAdmin) {
      blockingReason = null;
    } else if (completedCount < requiredCompletedCount) {
      blockingReason = "need_progress";
    } else if (!hasSquad) {
      blockingReason = "need_squad";
    } else if (!rawEligibility.is_squad_captain) {
      blockingReason = "need_captain";
    } else if (remaining <= 0) {
      blockingReason = "month_limit";
    } else if (cooldownHoursLeft > 0) {
      blockingReason = "cooldown";
    } else {
      blockingReason = null;
    }

    return {
      ...rawEligibility,
      eligible: blockingReason === null,
      required_completed_count: requiredCompletedCount,
      completed_count: completedCount,
      has_squad: hasSquad,
      squad_id: squadId,
      squad_title: squadTitle,
      is_admin: effectiveIsAdmin,
      monthly_limit: monthlyLimit,
      remaining_this_month: remaining,
      cooldown_hours_left: cooldownHoursLeft,
      blocking_reason_code: blockingReason,
    };
  }, [rawEligibility, localCompletedCount, forcedRole, isAllowlistedPredictionAdmin, mySquad?.id, mySquad?.title]);
  const selectedPrediction = predictions.find((prediction) => prediction.id === selectedPredictionId) || null;
  const canManageSelectedPrediction = Boolean(selectedPrediction && uiEligibilityForView.is_admin);
  const hasPredictionWarmupFlag = (() => {
    try {
      return window.localStorage.getItem(PREDICTION_WARMUP_DONE_KEY) === "true";
    } catch {
      return false;
    }
  })();
  const hasPredictionAccess = localCompletedCount > 0 || hasPredictionWarmupFlag;
  const homeCreateHint = isPredictionEligibilityLoading
    ? "Проверяем доступ..."
    : uiEligibilityForView.eligible
      ? `Доступно: осталось ${uiEligibilityForView.remaining_this_month}/${uiEligibilityForView.monthly_limit} в этом месяце`
      : `До доступа: ${uiEligibilityForView.completed_count}/${uiEligibilityForView.required_completed_count} тестов`;
  const listCreateBadge = isPredictionEligibilityLoading
    ? "Проверка..."
    : uiEligibilityForView.eligible
      ? `Осталось ${uiEligibilityForView.remaining_this_month}/${uiEligibilityForView.monthly_limit}`
      : "Требования";

  const openPredictionList = () => {
    setCurrentScreen("prediction_list");
  };

  const openPredictionDetails = (predictionId: string, backTarget: PredictionBackTarget) => {
    setSelectedPredictionId(predictionId);
    setPredictionBackTarget(backTarget);
    setCurrentScreen("prediction_details");
  };

  const handlePredictionChange = (nextPrediction: PredictionPoll) => {
    setPredictions((prev) =>
      prev.map((prediction) => (prediction.id === nextPrediction.id ? nextPrediction : prediction))
    );
  };

  const openCreatePrediction = async (entry: PredictionCreateEntry) => {
    setPredictionCreateEntry(entry);

    try {
      const { data } = await refetchPredictionEligibility();
      const latestRaw = data || predictionEligibility || fallbackEligibility;
      setGateEligibility(latestRaw);

      const latestCompletedCount = Math.max(latestRaw.completed_count || 0, localCompletedCount);
      const latestHasProgress = latestCompletedCount >= (latestRaw.required_completed_count || 3);
      const latestHasSquad = latestRaw.has_squad || Boolean(latestRaw.squad_id) || Boolean(mySquad?.id);
      const latestIsAdmin = forcedRole === "admin"
        ? true
        : forcedRole === "user"
          ? false
          : (latestRaw.is_admin || isAllowlistedPredictionAdmin);
      const latestCanCreate = latestIsAdmin || (
        latestHasProgress &&
        latestHasSquad &&
        latestRaw.is_squad_captain &&
        (latestRaw.remaining_this_month ?? 0) > 0 &&
        (latestRaw.cooldown_hours_left ?? 0) <= 0
      );

      if (latestCanCreate) {
        setIsCreateGateOpen(false);
        setGateEligibility(null);
        setCurrentScreen("create_prediction");
        return;
      }
      setIsCreateGateOpen(true);
    } catch {
      setGateEligibility(predictionEligibility || fallbackEligibility);
      setIsCreateGateOpen(true);
    }
  };

  const handlePredictionCreated = async (predictionId: string) => {
    await Promise.allSettled([refetchPredictionPolls(), refetchPredictionEligibility()]);

    if (!predictionId) {
      setCurrentScreen("prediction_list");
      return;
    }

    setSelectedPredictionId(predictionId);
    setPredictionBackTarget("prediction_list");
    setCurrentScreen("prediction_details");
  };

  const handleGateGoToTests = () => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(HOME_CONTENT_TYPE_STORAGE_KEY);
      if (stored === "tests" || stored === "quizzes") {
        setContentType(stored);
      }
    }
    setCurrentScreen("home");
    setActiveTab("home");
    setShouldScrollToContentBlock(true);
  };

  const handleGateCreateSquad = () => {
    setCurrentScreen("create_squad");
  };

  const handleGateOpenMySquad = () => {
    if (mySquad) {
      setSelectedSquad(mySquad);
      setCurrentScreen("squad_detail");
      return;
    }
    setCurrentScreen("squad_list");
  };

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const mergedQuizzes = useMemo(() => {
    const map = new Map<string, (typeof quizzes)[number]>();
    [...quizzes, ...myQuizzes].forEach((quiz) => {
      if (!quiz || !quiz.id) return;
      if (!map.has(quiz.id)) {
        map.set(quiz.id, quiz);
      }
    });
    return [...map.values()];
  }, [quizzes, myQuizzes]);

  const mergedTests = useMemo(() => {
    const map = new Map<string, (typeof personalityTests)[number]>();
    [...personalityTests, ...myPersonalityTests].forEach((test) => {
      if (!test || !test.id) return;
      if (!map.has(test.id)) {
        map.set(test.id, test);
      }
    });
    return [...map.values()];
  }, [personalityTests, myPersonalityTests]);

  const safeQuizzes = (Array.isArray(mergedQuizzes) ? mergedQuizzes : []).filter((quiz): quiz is typeof mergedQuizzes[number] => Boolean(quiz));
  const safeTests = (Array.isArray(mergedTests) ? mergedTests : []).filter((test): test is typeof mergedTests[number] => Boolean(test));
  const normalizeText = (value: unknown) => (typeof value === "string" ? value.toLowerCase() : "");
  const toSafeId = (value: unknown) => {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  };
  const toSafeNumber = (value: unknown) => {
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  };
  const getVisibleSaveCount = (entityId: string, rawSaveCount: unknown, savedSet: Set<string>) => {
    const base = toSafeNumber(rawSaveCount);
    return savedSet.has(entityId) ? Math.max(1, base) : base;
  };
  const normalizedQuizzes = safeQuizzes
    .map((quiz) => ({
      ...quiz,
      id: toSafeId((quiz as { id?: unknown }).id),
      title: typeof quiz.title === "string" && quiz.title.trim() ? quiz.title : "Без названия",
      participant_count: toSafeNumber((quiz as { participant_count?: unknown }).participant_count),
      like_count: toSafeNumber((quiz as { like_count?: unknown }).like_count),
      save_count: toSafeNumber((quiz as { save_count?: unknown }).save_count),
    }))
    .filter((quiz) => quiz.id.length > 0);
  const normalizedTests = safeTests
    .map((test) => ({
      ...test,
      id: toSafeId((test as { id?: unknown }).id),
      title: typeof test.title === "string" && test.title.trim() ? test.title : "Без названия",
      participant_count: toSafeNumber((test as { participant_count?: unknown }).participant_count),
      like_count: toSafeNumber((test as { like_count?: unknown }).like_count),
      save_count: toSafeNumber((test as { save_count?: unknown }).save_count),
    }))
    .filter((test) => test.id.length > 0);

  const filteredQuizzes = normalizedQuizzes.filter((quiz) => {
    if (!normalizedSearchQuery) return true;
    return (
      normalizeText(quiz.title).includes(normalizedSearchQuery) ||
      normalizeText(quiz.description).includes(normalizedSearchQuery)
    );
  });

  const filteredTests = normalizedTests.filter((test) => {
    if (!normalizedSearchQuery) return true;
    return (
      normalizeText(test.title).includes(normalizedSearchQuery) ||
      normalizeText(test.description).includes(normalizedSearchQuery)
    );
  });

  const getSortValue = (item?: {
    participant_count?: number | null;
    like_count?: number | null;
    save_count?: number | null;
    created_at?: string | null;
  } | null) => {
    switch (sortBy) {
      case "completed":
        return toSafeNumber(item?.participant_count);
      case "popular":
        return toSafeNumber(item?.like_count);
      case "saves":
        return toSafeNumber(item?.save_count);
      case "newest":
        return toSafeNumber(Date.parse(typeof item?.created_at === "string" ? item.created_at : ""));
      default:
        return 0;
    }
  };

  const compareBySort = <T extends {
    participant_count?: number | null;
    like_count?: number | null;
    save_count?: number | null;
    created_at?: string | null;
  }>(a: T, b: T) => {
    const aValue = getSortValue(a);
    const bValue = getSortValue(b);
    return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
  };

  const sortedQuizzes = [...filteredQuizzes].sort(compareBySort);
  const sortedTests = [...filteredTests].sort(compareBySort);

  // Shuffle questions for quiz (memoized to keep same order during session)
  const mappedQuestions = useMemo(() => {
    if (!quizData?.questions) return [];

    // Fisher-Yates shuffle
    const questions = quizData.questions.map((q, i) => ({
      id: i + 1,
      text: q.question_text,
      options: q.options.map(opt => opt.text),
      correctAnswer: typeof q.correct_answer === "number" ? q.correct_answer : undefined,
    }));

    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }

    return questions;
  }, [quizData?.questions, selectedQuizId]); // Re-shuffle when quiz changes

  const hasCorrectAnswers = mappedQuestions.some((q) => typeof q.correctAnswer === "number");

  const computeQuizResult = (answersList: number[]): QuizResult => {
    if (hasCorrectAnswers && mappedQuestions.length > 0) {
      const total = mappedQuestions.length;
      const correct = answersList.reduce((acc, answer, idx) => {
        const correctAnswer = mappedQuestions[idx]?.correctAnswer;
        return acc + (typeof correctAnswer === "number" && answer === correctAnswer ? 1 : 0);
      }, 0);
      const score = total > 0 ? Math.round((correct / total) * 100) : 0;
      const verdict = getVerdict(score);
      const percentile = Math.max(1, Math.min(99, Math.round(100 - score)));

      return {
        score,
        maxScore: 100,
        percentile,
        verdict: verdict.text,
        verdictEmoji: verdict.emoji,
      };
    }

    return calculateResult(answersList);
  };

  const showBottomNav = ["home", "gallery", "leaderboard", "profile"].includes(currentScreen);
  const displayQuizzes = sortedQuizzes.length > 0 || normalizedSearchQuery ? sortedQuizzes : [...normalizedQuizzes].sort(compareBySort);
  const displayTests = sortedTests.length > 0 || normalizedSearchQuery ? sortedTests : [...normalizedTests].sort(compareBySort);
  const displayQuizzesWithVisibleSaves = displayQuizzes.map((quiz) => ({
    ...quiz,
    save_count: getVisibleSaveCount(quiz.id, quiz.save_count, saveIds),
  }));
  const displayTestsWithVisibleSaves = displayTests.map((test) => ({
    ...test,
    save_count: getVisibleSaveCount(test.id, test.save_count, testSaveIds),
  }));
  const topPredictions = [...predictions]
    .filter((prediction) => prediction.status === "open" && !prediction.is_hidden)
    .sort((a, b) => {
      const poolDiff = (b.pool_a + b.pool_b) - (a.pool_a + a.pool_b);
      if (poolDiff !== 0) return poolDiff;
      return b.participant_count - a.participant_count;
    })
    .slice(0, 3);
  const selectedQuizIsPublished = Boolean(
    (quizData?.quiz as any)?.is_published === true || (quizData?.quiz as any)?.status === "published"
  );
  const selectedTestPreview = selectedTestDetails?.test
    ?? mergedTests.find((test) => test.id === selectedTestId)
    ?? null;
  const selectedTestIsPublished = Boolean(
    (selectedTestPreview as any)?.is_published === true || (selectedTestPreview as any)?.status === "published"
  );

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
              className="p-4 safe-bottom-nav space-y-4"
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

              <PredictionTopBlock
                predictions={topPredictions}
                createHint={homeCreateHint}
                onCreatePrediction={() => {
                  void openCreatePrediction("home");
                }}
                onOpenAll={openPredictionList}
                onOpenPrediction={(predictionId) => openPredictionDetails(predictionId, "home")}
              />

              {/* Content Type Tabs: Quizzes / Tests */}
              <motion.div
                ref={homeContentBlockRef}
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

              {/* Sort chips + direction + search */}
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
                          placeholder={contentType === "quizzes" ? "Поиск квизов..." : "Поиск тестов..."}
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

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      haptic.selection();
                      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
                    }}
                    className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-secondary text-muted-foreground flex items-center gap-1 shrink-0"
                    aria-label={sortDirection === "desc" ? "Сортировка по убыванию" : "Сортировка по возрастанию"}
                  >
                    {sortDirection === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
                    {sortDirection === "desc" ? "Сначала больше" : "Сначала меньше"}
                  </button>

                  {!searchOpen && (
                    <button
                      onClick={() => {
                        haptic.selection();
                        setSearchOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-secondary text-muted-foreground flex items-center gap-1 shrink-0"
                    >
                      <Search className="w-3 h-3" />
                      Поиск
                    </button>
                  )}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {(["completed", "newest", "popular", "saves"] as const).map((sort) => (
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
                      {sort === "completed" && <><Users className="w-3 h-3" /> Пройдено</>}
                      {sort === "newest" && "✨ Новые"}
                      {sort === "popular" && <><PopcornIcon className="w-3 h-3" /> Лайки</>}
                      {sort === "saves" && <><BookmarkIcon className="w-3 h-3" /> В избранном</>}
                    </button>
                  ))}
                </div>
              </motion.div>

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
                        quizzes={displayQuizzesWithVisibleSaves}
                        isLoading={quizzesLoading}
                        onQuizSelect={handleQuizSelect}
                        likeIds={likeIds}
                        saveIds={saveIds}
                        completedIds={completedQuizIds}
                        onToggleLike={handleToggleLike}
                        onToggleSave={handleToggleSave}
                      />
                    )}
                  </>
                ) : (
                  // Personality Tests List
                  <>
                    {!testsLoading && displayTests.length === 0 ? (
                      <div className="tg-section p-6 text-center">
                        <Sparkles className="w-10 h-10 text-purple-500 mx-auto mb-3" />
                        <h3 className="font-semibold text-foreground mb-2">
                          {searchQuery ? "Ничего не найдено" : "Нет тестов"}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {searchQuery ? "Попробуй изменить поисковый запрос" : "Создай первый тест личности!"}
                        </p>
                        {!searchQuery && (
                          <button
                            className="tg-button bg-purple-500 hover:bg-purple-600"
                            onClick={() => {
                              haptic.impact('medium');
                              setCurrentScreen("create_test");
                            }}
                          >
                            Создать тест
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {displayTestsWithVisibleSaves.map((test, index) => (
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
                              is_anonymous={test.is_anonymous}
                              creator={test.creator}
                              isCompleted={completedTestIds.has(test.id)}
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

          {currentScreen === "prediction_list" && (
            <PredictionListScreen
              key="prediction_list"
              predictions={predictions}
              mySquadId={mySquad?.id}
              createQuotaBadge={listCreateBadge}
              onCreatePrediction={() => {
                void openCreatePrediction("prediction_list");
              }}
              onBack={requestBack}
              onOpenPrediction={(predictionId) => openPredictionDetails(predictionId, "prediction_list")}
            />
          )}

          {currentScreen === "create_prediction" && (
            <CreatePredictionScreen
              key="create_prediction"
              eligibility={uiEligibilityForView}
              onBack={requestBack}
              onCreated={(pollId) => {
                void handlePredictionCreated(pollId);
              }}
            />
          )}

          {currentScreen === "prediction_details" && selectedPrediction && (
            <PredictionDetailsScreen
              key={`prediction_details_${selectedPrediction.id}`}
              prediction={selectedPrediction}
              canManage={canManageSelectedPrediction}
              hasPredictionAccess={hasPredictionAccess}
              onRequirePredictionAccess={handleGateGoToTests}
              onPredictionChange={handlePredictionChange}
              onBack={requestBack}
            />
          )}

          {currentScreen === "prediction_details" && !selectedPrediction && (
            <motion.div
              key="prediction_details_missing"
              className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h2 className="text-lg font-semibold text-foreground">Событие не найдено</h2>
              <p className="text-sm text-muted-foreground">
                Возможно, ссылка устарела или событие было скрыто.
              </p>
              <button
                onClick={() => {
                  setCurrentScreen("prediction_list");
                }}
                className="tg-button"
              >
                К списку событий
              </button>
            </motion.div>
          )}

          {currentScreen === "pvp" && (
            <PvpLobbyScreen
              key="pvp"
              onBack={requestBack}
              onStartGame={(roomId, quizId) => {
                console.log("Starting PvP game:", roomId, quizId);
              }}
            />
          )}

          {currentScreen === "gallery" && (
            <CreatorsScreen
              key="gallery"
              onBack={requestBack}
            />
          )}

          {currentScreen === "quiz_preview" && selectedQuizId && quizData?.quiz && (
            <QuizPreviewScreen
              key="quiz_preview"
              quiz={{
                id: quizData.quiz.id,
                title: quizData.quiz.title,
                description: quizData.quiz.description,
                image_url: quizData.quiz.image_url,
                question_count: quizData.quiz.question_count || quizData.questions?.length || 0,
                duration_seconds: quizData.quiz.duration_seconds || 60,
                participant_count: quizData.quiz.participant_count || 0,
                like_count: quizData.quiz.like_count || 0,
                save_count: getVisibleSaveCount(selectedQuizId, quizData.quiz.save_count || 0, saveIds),
                is_anonymous: quizData.quiz.is_anonymous ?? false,
                creator: quizData.quiz.creator,
                is_published: (quizData.quiz as any).is_published ?? true,
                status: (quizData.quiz as any).status ?? null,
              }}
              isLiked={likeIds.has(selectedQuizId)}
              isSaved={saveIds.has(selectedQuizId)}
              onBack={requestBack}
              onStart={handleStartQuiz}
              onToggleLike={selectedQuizIsPublished
                ? () => toggleLike.mutate({ quizId: selectedQuizId, isLiked: likeIds.has(selectedQuizId) })
                : undefined}
              onToggleSave={selectedQuizIsPublished
                ? () => toggleSave.mutate({ quizId: selectedQuizId, isFavorite: saveIds.has(selectedQuizId) })
                : undefined}
            />
          )}

          {currentScreen === "quiz" && (
            <QuizScreen
              key="quiz"
              questions={mappedQuestions.length > 0 ? mappedQuestions : undefined}
              currentQuestion={currentQuestion}
              onAnswer={handleAnswer}
              durationSeconds={quizData?.quiz?.duration_seconds || 0}
              onTimeUp={() => {
                const quizResult = computeQuizResult(answers);
                quizCompletedRef.current = true;
                setResult({
                  ...quizResult,
                  verdict: "Время вышло!",
                  verdictEmoji: "⏰",
                });
                persistQuizCompletion(selectedQuizId, quizResult, answers);
                try {
                  window.localStorage.setItem(PREDICTION_WARMUP_DONE_KEY, "true");
                } catch {
                  // ignore
                }
                track(
                  "quiz_complete",
                  {
                    score: quizResult.score,
                    max_score: quizResult.maxScore,
                    time_total_ms: Math.max(0, Date.now() - quizStartTime.current),
                    percentile: quizResult.percentile,
                  },
                  selectedQuizId || undefined
                );
                setCurrentScreen("result");
              }}
            />
          )}

          {currentScreen === "test_preview" && selectedTestId && selectedTestPreview && (
            <PersonalityTestPreviewScreen
              key="test_preview"
              test={{
                id: selectedTestPreview.id,
                title: selectedTestPreview.title,
                description: selectedTestPreview.description,
                image_url: selectedTestPreview.image_url,
                question_count: selectedTestPreview.question_count || 0,
                result_count: selectedTestPreview.result_count || 0,
                participant_count: selectedTestPreview.participant_count || 0,
                like_count: selectedTestPreview.like_count || 0,
                save_count: getVisibleSaveCount(selectedTestId, selectedTestPreview.save_count || 0, testSaveIds),
                is_anonymous: selectedTestPreview.is_anonymous ?? false,
                creator: selectedTestPreview.creator,
                is_published: (selectedTestPreview as any).is_published ?? true,
                status: (selectedTestPreview as any).status ?? null,
              }}
              isLiked={testLikeIds.has(selectedTestId)}
              isSaved={testSaveIds.has(selectedTestId)}
              onBack={requestBack}
              onStart={handleStartTest}
              onToggleLike={selectedTestIsPublished
                ? () => toggleTestLike.mutate({ testId: selectedTestId, isLiked: testLikeIds.has(selectedTestId) })
                : undefined}
              onToggleSave={selectedTestIsPublished
                ? () => toggleTestSave.mutate({ testId: selectedTestId, isFavorite: testSaveIds.has(selectedTestId) })
                : undefined}
            />
          )}

          {currentScreen === "test_preview" && selectedTestId && !selectedTestPreview && (
            <motion.div
              key="test_preview_loading"
              className="min-h-screen flex items-center justify-center p-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <Sparkles className="w-4 h-4 animate-pulse text-purple-500" />
                Загружаем тест...
              </div>
            </motion.div>
          )}

          {currentScreen === "personality_test" && selectedTestId && (
            <PersonalityTestScreen
              key="personality_test"
              testId={selectedTestId}
              onBack={requestBack}
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
              onBack={requestBack}
              onSuccess={handlePersonalityTestCreated}
            />
          )}

          {currentScreen === "result" && result && (
            <ResultScreen
              key="result"
              result={result}
              quizId={selectedQuizId || undefined}
              quizTitle={quizData?.quiz?.title}
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
              onBack={requestBack}
            />
          )}

          {currentScreen === "profile" && (
            <ProfileScreen
              key="profile"
              stats={userStats}
              activeTab={profileTab}
              onTabChange={setProfileTab}
              onBack={requestBack}
              onOpenAdmin={() => setCurrentScreen("admin")}
              onQuizSelect={handleQuizSelect}
              onTestSelect={handleTestSelect}
              onOpenSquadList={() => setCurrentScreen("squad_list")}
              onOpenCreateSquad={() => setCurrentScreen("create_squad")}
            />
          )}

          {currentScreen === "admin" && (
            <AdminPanel
              key="admin"
              onBack={requestBack}
              onOpenPrediction={(predictionId) => openPredictionDetails(predictionId, "admin")}
              onCreateTest={() => setCurrentScreen("create_test")}
              onCreatePrediction={() => {
                void openCreatePrediction("admin");
              }}
              rolePreviewMode={rolePreviewMode}
              onRolePreviewChange={setRolePreviewMode}
            />
          )}

          {currentScreen === "leaderboard" && (
            <LeaderboardScreen
              key="leaderboard"
              onBack={requestBack}
              onSquadSelect={(squad) => {
                setSelectedSquad(squad);
                setCurrentScreen("squad_detail");
              }}
            />
          )}

          {currentScreen === "squad_list" && (
            <SquadListScreen
              key="squad_list"
              onBack={requestBack}
              onSquadSelect={(squad) => {
                setSelectedSquad(squad);
                setCurrentScreen("squad_detail");
              }}
              onCreateSquad={() => {
                setCurrentScreen("create_squad");
              }}
            />
          )}

          {currentScreen === "squad_detail" && selectedSquad && (
            <SquadScreen
              key="squad_detail"
              squad={selectedSquad}
              onBack={requestBack}
            />
          )}

          {currentScreen === "create_squad" && (
            <CreateSquadGuide
              key="create_squad"
              onBack={requestBack}
            />
          )}

          {currentScreen === "create_select" && (
            <motion.div
              key="create_select"
              className="min-h-screen flex flex-col bg-background pb-24"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Header */}
              <div className="sticky top-0 bg-background/80 backdrop-blur-lg z-10 px-4 py-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <button
                    className="p-2 -ml-2 text-primary"
                    onClick={() => {
                      haptic.selection();
                      requestBack();
                    }}
                  >
                    <X className="w-6 h-6" />
                  </button>
                  <h1 className="text-lg font-semibold text-foreground">Создать</h1>
                  <div className="w-10" />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 p-5 flex flex-col justify-center gap-4">
                <motion.button
                  className="tg-section p-6 flex items-center gap-4 text-left"
                  onClick={() => {
                    haptic.impact('medium');
                    setCurrentScreen("create");
                  }}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="w-7 h-7 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground">Квиз</h3>
                    <p className="text-sm text-muted-foreground">
                      Вопросы с правильными ответами и баллами
                    </p>
                  </div>
                </motion.button>

                <motion.button
                  className="tg-section p-6 flex items-center gap-4 text-left"
                  onClick={() => {
                    haptic.impact('medium');
                    setCurrentScreen("create_test");
                  }}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                    <Sparkles className="w-7 h-7 text-purple-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground">Тест личности</h3>
                    <p className="text-sm text-muted-foreground">
                      Узнай какой ты... с разными результатами
                    </p>
                  </div>
                </motion.button>
              </div>
            </motion.div>
          )}

          {currentScreen === "create" && (
            <CreateQuizScreen
              key="create"
              onBack={requestBack}
              onSuccess={handleQuizCreated}
            />
          )}
        </AnimatePresence>
      </div>

      <CreatePredictionGateModal
        open={isCreateGateOpen}
        onOpenChange={(open) => {
          setIsCreateGateOpen(open);
          if (!open) {
            setGateEligibility(null);
          }
        }}
        eligibility={uiEligibilityForView}
        quota={predictionQuota}
        onGoToTests={handleGateGoToTests}
        onCreateSquad={handleGateCreateSquad}
        onOpenMySquad={handleGateOpenMySquad}
      />

      {showBottomNav && (
        <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
      )}
    </div>
  );
};

export default Index;
