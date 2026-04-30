import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { PosterCard } from "../cards/PosterCard";
import { EpisodeCard } from "../cards/EpisodeCard";
import { RowHeader } from "./RowHeader";
import { RowScrollControls } from "./RowScrollControls";
import { useRowScroll } from "./useRowScroll";

export type CardVariant = "poster" | "episode";

interface MediaRowProps {
  title: string;
  items: MediaItem[];
  /** Card aspect ratio. Default `poster` (2:3). Use `episode` (16:9) for resume rows. */
  variant?: CardVariant;
  /** Stagger delay in ms for the row entrance animation. */
  animDelay?: number;
  /** Optional href for the "Tout voir" link. */
  href?: string;
}

/**
 * Horizontal scrolling row of media cards. Replacement for `MediaCarousel`.
 * Lazy-renders cards only after the row enters the viewport.
 */
export function MediaRow({ title, items, variant = "poster", animDelay = 0, href }: MediaRowProps) {
  const { t } = useTranslation("common");
  const rowRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const { scrollRef, canScrollLeft, canScrollRight, scrollByAmount, onScroll } = useRowScroll();

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisible(true),
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); scrollByAmount("right"); }
    if (e.key === "ArrowLeft") { e.preventDefault(); scrollByAmount("left"); }
  }, [scrollByAmount]);

  if (!items.length) {
    return (
      <section className="mb-8">
        <RowHeader title={title} />
        <p className="row-gutter text-sm text-white/45">{t("common:noResults")}</p>
      </section>
    );
  }

  const Card = variant === "episode" ? EpisodeCard : PosterCard;

  return (
    <section
      ref={rowRef}
      className="group/row relative mb-10"
      tabIndex={0}
      role="region"
      aria-label={title}
      onKeyDown={handleKeyDown}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: `opacity 0.5s ease ${animDelay}ms, transform 0.5s ease ${animDelay}ms`,
      }}
    >
      <RowHeader title={title} href={href} />

      <div className="relative">
        <RowScrollControls
          canLeft={canScrollLeft}
          canRight={canScrollRight}
          onScroll={scrollByAmount}
        />

        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="row-gutter flex gap-3 overflow-x-auto overflow-y-visible pb-12 pt-2 scrollbar-hide"
        >
          {visible && items.map((item, i) => <Card key={item.Id} item={item} index={i} />)}
        </div>
      </div>
    </section>
  );
}
