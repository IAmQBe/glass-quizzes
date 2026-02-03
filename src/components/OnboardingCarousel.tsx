import { useState } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { Brain, Trophy, Users, Sparkles, Zap } from "lucide-react";
import { haptic } from "@/lib/telegram";

interface OnboardingSlide {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}

const slides: OnboardingSlide[] = [
  {
    icon: <Brain className="w-16 h-16" />,
    title: "Mind Test",
    description: "Проверяй свои знания и соревнуйся с друзьями в увлекательных квизах",
    gradient: "from-primary to-primary/60",
  },
  {
    icon: <Trophy className="w-16 h-16" />,
    title: "Соревнуйся",
    description: "Попадай в топ лидерборда и получай кубки в конце каждого сезона",
    gradient: "from-yellow-500 to-amber-400",
  },
  {
    icon: <Users className="w-16 h-16" />,
    title: "Создавай",
    description: "Создавай собственные квизы и делись ими с сообществом",
    gradient: "from-green-500 to-emerald-400",
  },
  {
    icon: <Zap className="w-16 h-16" />,
    title: "Live квизы",
    description: "Проводи онлайн-квизы в реальном времени с участниками со всего мира",
    gradient: "from-purple-500 to-pink-400",
  },
  {
    icon: <Sparkles className="w-16 h-16" />,
    title: "Готов начать?",
    description: "Присоединяйся к тысячам игроков и стань лучшим!",
    gradient: "from-primary to-accent",
  },
];

interface OnboardingCarouselProps {
  onComplete: () => void;
}

export const OnboardingCarousel = ({ onComplete }: OnboardingCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleDragEnd = (e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 50;
    
    if (info.offset.x < -threshold && currentIndex < slides.length - 1) {
      setCurrentIndex(prev => prev + 1);
      haptic.impact('light');
    } else if (info.offset.x > threshold && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      haptic.impact('light');
    }
  };

  const handleNext = () => {
    haptic.impact('medium');
    if (currentIndex < slides.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    haptic.selection();
    onComplete();
  };

  const slide = slides[currentIndex];
  const isLast = currentIndex === slides.length - 1;

  return (
    <motion.div
      className="fixed inset-0 bg-background z-50 flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Skip button */}
      <div className="flex justify-end p-4">
        <button
          onClick={handleSkip}
          className="text-sm text-muted-foreground"
        >
          Пропустить
        </button>
      </div>

      {/* Slide content */}
      <motion.div
        className="flex-1 flex flex-col items-center justify-center px-8"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            className="flex flex-col items-center text-center"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            {/* Icon with gradient background */}
            <div className={`w-32 h-32 rounded-full bg-gradient-to-br ${slide.gradient} flex items-center justify-center text-white mb-8 shadow-lg`}>
              {slide.icon}
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-4">
              {slide.title}
            </h2>

            <p className="text-muted-foreground text-lg leading-relaxed max-w-xs">
              {slide.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Dots and button */}
      <div className="p-8 space-y-6">
        {/* Dots */}
        <div className="flex justify-center gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                haptic.selection();
                setCurrentIndex(index);
              }}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentIndex
                  ? "bg-primary w-6"
                  : "bg-primary/30"
              }`}
            />
          ))}
        </div>

        {/* Next/Start button */}
        <button
          onClick={handleNext}
          className="tg-button w-full"
        >
          {isLast ? "Начать" : "Далее"}
        </button>
      </div>
    </motion.div>
  );
};
