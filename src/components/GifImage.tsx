import { useEffect, useMemo, useState } from "react";
import type { ImgHTMLAttributes } from "react";
import { useGifAnimations } from "@/hooks/useGifAnimations";

type GifImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  disableAnimation?: boolean;
};

const isGifSource = (src?: string) => {
  if (!src) return false;
  if (src.startsWith("data:image/gif")) return true;
  return /\.gif($|\?)/i.test(src);
};

export const GifImage = ({ src, disableAnimation, ...props }: GifImageProps) => {
  const { animationsEnabled } = useGifAnimations();
  const animationsOn = disableAnimation !== undefined ? !disableAnimation : animationsEnabled;
  const gifSrc = typeof src === "string" ? src : undefined;
  const isGif = useMemo(() => isGifSource(gifSrc), [gifSrc]);
  const [staticSrc, setStaticSrc] = useState<string | null>(null);

  useEffect(() => {
    setStaticSrc(null);
    if (!gifSrc || animationsOn || !isGif) return;

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx || !canvas.width || !canvas.height) {
        setStaticSrc(gifSrc);
        return;
      }
      ctx.drawImage(img, 0, 0);
      try {
        const dataUrl = canvas.toDataURL("image/png");
        setStaticSrc(dataUrl);
      } catch (error) {
        setStaticSrc(gifSrc);
      }
    };
    img.onerror = () => {
      if (!cancelled) setStaticSrc(gifSrc);
    };
    img.src = gifSrc;

    return () => {
      cancelled = true;
    };
  }, [gifSrc, animationsOn, isGif]);

  const renderSrc = animationsOn || !isGif ? gifSrc : staticSrc || undefined;

  return <img src={renderSrc} {...props} />;
};
