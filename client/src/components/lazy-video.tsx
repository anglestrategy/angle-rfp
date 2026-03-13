import React, { useRef, useState, useEffect, useCallback } from "react";

type LazyVideoProps = {
  /** WebM source (primary — VP9 with alpha) */
  webmSrc: string;
  /** MP4 source (fallback — H.264, no alpha) */
  mp4Src: string;
  /** JPEG poster frame for instant display before video loads */
  posterSrc: string;
  /** CSS class for the container */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
  /** Start loading when this many pixels from viewport */
  rootMargin?: string;
  /** Light mode filter adjustment */
  lightModeFilter?: boolean;
};

export function LazyVideo({
  webmSrc,
  mp4Src,
  posterSrc,
  className,
  style,
  rootMargin = "200px",
  lightModeFilter = true,
}: LazyVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // IntersectionObserver — start loading when near viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  const handleCanPlay = useCallback(() => {
    setIsLoaded(true);
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* Poster frame — shown until video loads */}
      <img
        src={posterSrc}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: isLoaded ? 0 : 1,
          transition: "opacity 0.6s ease",
          pointerEvents: "none",
        }}
      />

      {/* Shimmer placeholder */}
      {!isLoaded && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 2s infinite",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Video — only rendered after IntersectionObserver triggers */}
      {isVisible && (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          onCanPlay={handleCanPlay}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: isLoaded ? 1 : 0,
            transition: "opacity 0.6s ease",
          }}
        >
          <source src={webmSrc} type='video/webm; codecs="vp9"' />
          <source src={mp4Src} type="video/mp4" />
        </video>
      )}
    </div>
  );
}
