import { useRef, useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { CarouselCard } from "./CarouselCard";

interface MediaCarouselProps {
  title: string;
  items: MediaItem[];
  /** Extra delay (ms) added to entry animations for cascade sequencing */
  animDelay?: number;
}

export function MediaCarousel({ title, items, animDelay = 0 }: MediaCarouselProps) {
  const { t } = useTranslation("common");
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [visible, setVisible] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -400 : 400, behavior: "smooth" });
    setTimeout(updateScrollState, 350);
  };

  // IntersectionObserver for entry animations
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); scroll("right"); }
    if (e.key === "ArrowLeft") { e.preventDefault(); scroll("left"); }
  }, []);

  if (!items.length) {
    return (
      <section className="mb-6">
        <div className="mb-4 px-4 md:px-8">
          <h2 className="text-lg font-bold tracking-tight text-white/90">{title}</h2>
        </div>
        <p className="px-4 text-sm text-white/50 md:px-8">{t("common:noResults")}</p>
      </section>
    );
  }

  return (
    <section
      ref={rowRef}
      className="group/row relative mb-6"
      tabIndex={0}
      role="region"
      aria-label={title}
      onKeyDown={handleKeyDown}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: `all 0.6s ease ${animDelay}ms`,
      }}
    >
      {/* Title with "Tout voir" on hover */}
      <div className="mb-4 flex items-center gap-2 px-4 md:px-8">
        <h2 className="text-lg font-bold tracking-tight text-white/90">{title}</h2>
        <span className="-translate-x-2 flex items-center gap-0.5 text-xs font-medium text-purple-400 opacity-0 transition-all duration-300 group-hover/row:translate-x-0 group-hover/row:opacity-100">
          {t("common:seeAll")}
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>

      <div className="relative">
        {/* Left fade + button */}
        {canScrollLeft && (
          <>
            <div
              className="pointer-events-none absolute bottom-4 left-0 top-0 z-10 w-16"
              style={{ background: "linear-gradient(to right, #08081280, transparent)" }}
            />
            <button
              onClick={() => scroll("left")}
              className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-white/80 opacity-0 transition-all duration-300 group-hover/row:opacity-100"
              style={{
                background: "rgba(139,92,246,0.6)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </>
        )}

        {/* Right fade + button */}
        {canScrollRight && (
          <>
            <div
              className="pointer-events-none absolute bottom-4 right-0 top-0 z-10 w-16"
              style={{ background: "linear-gradient(to left, #08081280, transparent)" }}
            />
            <button
              onClick={() => scroll("right")}
              className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-white/80 opacity-0 transition-all duration-300 group-hover/row:opacity-100"
              style={{
                background: "rgba(139,92,246,0.6)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="flex gap-4 overflow-x-auto scroll-smooth px-4 pb-4 scrollbar-hide md:px-8"
        >
          {visible && items.map((item, i) => <CarouselCard key={item.Id} item={item} index={i} />)}
        </div>
      </div>
    </section>
  );
}
