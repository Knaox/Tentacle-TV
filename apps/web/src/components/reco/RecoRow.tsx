import { useCallback, useEffect, useRef, useState } from "react";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import { RowHeader } from "../rows/RowHeader";
import { RowScrollControls } from "../rows/RowScrollControls";
import { useRowScroll } from "../rows/useRowScroll";
import { useRowCardWidth } from "../rows/useRowCardWidth";
import { useRowWindow } from "../rows/useRowWindow";
import { useHoverMount } from "../../hooks/useHoverMount";
import { useInViewport } from "../../hooks/useInViewport";
import { RecoCard } from "./RecoCard";

interface RecoRowProps {
  title: string;
  items: RecoRowItem[];
  animDelay?: number;
}

/**
 * Rangée de recommandations — frère assumé de `MediaRow` (le dépôt a déjà deux
 * carrousels distincts), qui réutilise TOUT le moteur de fenêtrage partagé :
 * `rowWindow`/`useRowWindow` (cartes visibles + 3, fenêtre vidée hors écran),
 * `useRowCardWidth` (nombre entier de cartes), `RowHeader`, `RowScrollControls`
 * (montés au survol — backdrop-filter). Les items ne sont pas des MediaItem
 * Jellyfin : dupliquer la coquille (~90 lignes) coûte moins que généraliser un
 * composant chaud de l'accueil.
 */
export function RecoRow({ title, items, animDelay = 0 }: RecoRowProps) {
  const [rowEl, setRowEl] = useState<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const { scrollRef, canScrollLeft, canScrollRight, scrollByAmount, onScroll } = useRowScroll();
  const cardWidth = useRowCardWidth(scrollRef, "poster");
  const { ref: observeRow, visible: rowOnScreen } = useInViewport<HTMLElement>("400px");
  const setRowRoot = useCallback((el: HTMLElement | null) => {
    setRowEl(el);
    observeRow(el);
  }, [observeRow]);
  const track = useRowWindow({ scrollRef, count: items.length, cardWidth, onScreen: rowOnScreen });
  const { range } = track;

  // Cascade d'entrée jouée une seule fois (cf. MediaRow — même raison).
  const stagger = useRef(true);
  useEffect(() => {
    if (!stagger.current || range.end < range.start) return;
    const id = setTimeout(() => { stagger.current = false; }, 760);
    return () => clearTimeout(id);
  }, [range.start, range.end]);

  const handleScroll = useCallback(() => {
    onScroll();
    track.onScroll();
  }, [onScroll, track]);
  const controls = useHoverMount(200);

  useEffect(() => {
    if (!rowEl) return;
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisible(true),
      { threshold: 0.1 }
    );
    observer.observe(rowEl);
    return () => observer.disconnect();
  }, [rowEl]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); scrollByAmount("right"); }
    if (e.key === "ArrowLeft") { e.preventDefault(); scrollByAmount("left"); }
  }, [scrollByAmount]);

  // Rangée vide : rien du tout — jamais de rangée vide ni de message d'erreur
  // sur cette page (mode dégradé silencieux).
  if (!items.length) return null;

  return (
    <section
      ref={setRowRoot}
      className="render-row group/row relative mb-10"
      tabIndex={0}
      role="region"
      aria-label={title}
      onKeyDown={handleKeyDown}
      onMouseEnter={controls.onMouseEnter}
      onMouseLeave={controls.onMouseLeave}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: `opacity 0.35s ease ${animDelay}ms, transform 0.35s ease ${animDelay}ms`,
      }}
    >
      <RowHeader title={title} />

      <div className="relative">
        <RowScrollControls
          canLeft={canScrollLeft}
          canRight={canScrollRight}
          mounted={controls.mounted}
          shown={controls.hovered}
          onScroll={scrollByAmount}
        />

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="row-dim row-gutter flex snap-x snap-proximity gap-3 overflow-x-auto overflow-y-visible pb-6 pt-8 scrollbar-hide scroll-pl-[var(--row-gutter-mobile)] md:scroll-pl-[var(--row-gutter-desktop)]"
        >
          {visible && (
            <>
              {range.padStart > 0 && (
                <div aria-hidden style={{ width: range.padStart, flexShrink: 0 }} />
              )}
              {items.slice(range.start, range.end + 1).map((item, offset) => {
                const i = range.start + offset;
                const entrance = stagger.current ? Math.min(i * 40, 400) : null;
                return (
                  <RecoCard
                    key={`${item.key}-${i}`}
                    item={item}
                    index={i}
                    width={cardWidth}
                    entranceDelay={entrance}
                    onHoverIndex={track.setHoveredIndex}
                  />
                );
              })}
              {range.padEnd > 0 && (
                <div aria-hidden style={{ width: range.padEnd, flexShrink: 0 }} />
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
