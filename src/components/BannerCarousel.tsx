import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { haptic, getTelegram } from "@/lib/telegram";

interface Banner {
  id: string;
  title: string;
  description?: string;
  image_url: string;
  link_url?: string;
  link_type: "internal" | "external";
}

interface BannerCarouselProps {
  banners: Banner[];
}

const AUTO_SWIPE_INTERVAL = 3500; // 3.5 seconds
const MANUAL_SWIPE_DELAY = 10000; // 10 seconds after manual interaction

export const BannerCarousel = ({ banners }: BannerCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoSwipeDelay, setAutoSwipeDelay] = useState(AUTO_SWIPE_INTERVAL);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  const goToSlide = useCallback((index: number) => {
    haptic.selection();
    setCurrentIndex(index);
    setAutoSwipeDelay(MANUAL_SWIPE_DELAY);
  }, []);

  // Auto-swipe logic
  useEffect(() => {
    if (banners.length <= 1) return;

    timerRef.current = setInterval(() => {
      nextSlide();
    }, autoSwipeDelay);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [banners.length, nextSlide, autoSwipeDelay]);

  // Reset timer after auto-swipe delay changes
  useEffect(() => {
    if (autoSwipeDelay === MANUAL_SWIPE_DELAY) {
      const resetTimer = setTimeout(() => {
        setAutoSwipeDelay(AUTO_SWIPE_INTERVAL);
      }, MANUAL_SWIPE_DELAY);
      return () => clearTimeout(resetTimer);
    }
  }, [autoSwipeDelay]);

  const handleDragEnd = (e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 50;
    
    if (info.offset.x < -threshold) {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
      setAutoSwipeDelay(MANUAL_SWIPE_DELAY);
      haptic.impact('light');
    } else if (info.offset.x > threshold) {
      setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
      setAutoSwipeDelay(MANUAL_SWIPE_DELAY);
      haptic.impact('light');
    }
  };

  const handleBannerClick = () => {
    const banner = banners[currentIndex];
    if (!banner.link_url) return;

    haptic.impact('medium');

    if (banner.link_type === 'external') {
      const tg = getTelegram();
      if (tg) {
        tg.openLink(banner.link_url);
      } else {
        window.open(banner.link_url, '_blank');
      }
    } else {
      navigate(banner.link_url);
    }
  };

  if (banners.length === 0) return null;

  const banner = banners[currentIndex];

  return (
    <div className="relative w-full">
      {/* Banner Container */}
      <motion.div
        className="relative overflow-hidden rounded-2xl cursor-pointer"
        style={{ aspectRatio: "16 / 7" }}
        onClick={handleBannerClick}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
      >
        <AnimatePresence mode="popLayout">
          <motion.div
            key={banner.id}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ 
              duration: 0.5, 
              ease: [0.25, 0.46, 0.45, 0.94]
            }}
          >
            {/* Image */}
            <img
              src={banner.image_url}
              alt={banner.title}
              className="w-full h-full object-cover"
              draggable={false}
            />
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            
            {/* Content */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h3 className="text-white font-semibold text-lg mb-1">
                {banner.title}
              </h3>
              {banner.description && (
                <p className="text-white/80 text-sm line-clamp-1">
                  {banner.description}
                </p>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Dots Indicator */}
      {banners.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentIndex
                  ? "bg-primary w-4"
                  : "bg-primary/30"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};