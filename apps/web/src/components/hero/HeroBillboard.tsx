import { useState, useEffect, useCallback, useRef } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import { HeroBackdrop, HERO_ZOOM_DURATION_S } from "./HeroBackdrop";
import { HeroContent } from "./HeroContent";
import { HeroIndicators } from "./HeroIndicators";

interface HeroBillboardProps {
  items: MediaItem[];
  /** Auto-rotate interval in ms. Set to 0 to disable. Default = zoom duration. */
  rotateMs?: number;
}

// Synchronisé avec le zoom du backdrop : on change de slide pile à la fin
// du cycle scale 1 → 1.10 pour un enchaînement perçu comme continu.
const DEFAULT_ROTATE_MS = HERO_ZOOM_DURATION_S * 1000;

/**
 * Cinematic full-bleed billboard — the centerpiece of the home page.
 * Targets ~92vh so the topnav floats transparent over its top edge and the
 * fade-to-black bottom flows seamlessly into the first row below.
 */
export function HeroBillboard({ items, rotateMs = DEFAULT_ROTATE_MS }: HeroBillboardProps) {
  const [index, setIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const pausedRef = useRef(false);

  const advance = useCallback(
    (delta: 1 | -1) => {
      if (!items.length) return;
      setIndex((i) => (i + delta + items.length) % items.length);
      setAnimKey((k) => k + 1);
    },
    [items.length],
  );

  const goTo = useCallback(
    (i: number) => {
      if (i < 0 || i >= items.length) return;
      setIndex(i);
      setAnimKey((k) => k + 1);
    },
    [items.length],
  );

  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    if (rotateMs > 0 && items.length > 1 && !pausedRef.current) {
      timerRef.current = setInterval(() => advance(1), rotateMs);
    }
  }, [rotateMs, items.length, advance]);

  useEffect(() => {
    startTimer();
    return () => clearInterval(timerRef.current);
  }, [startTimer, index]);

  const pause = () => {
    pausedRef.current = true;
    clearInterval(timerRef.current);
  };

  const resume = () => {
    pausedRef.current = false;
    startTimer();
  };

  if (!items.length) {
    return <div className="h-[80vh] w-full md:h-[88vh] lg:h-[92vh]" />;
  }

  // NB: pas de onMouseEnter={pause}/onMouseLeave={resume} sur la section —
  // le hero couvre ~90vh, le curseur le survole quasi en permanence, ce qui
  // figeait le carrousel à la première slide. Le timer continue de tourner ;
  // l'utilisateur peut toujours interrompre via les flèches / indicateurs
  // (qui font un pause éphémère 100ms pour absorber le clic).
  return (
    <section
      className="group/billboard relative w-full overflow-hidden h-[80vh] md:h-[88vh] lg:h-[92vh]"
      aria-label="Featured content"
    >
      <HeroBackdrop items={items} activeIndex={index} />
      <HeroContent item={items[index]} animationKey={animKey} />
      <HeroIndicators
        count={items.length}
        activeIndex={index}
        onSelect={(i) => { goTo(i); pause(); setTimeout(resume, 100); }}
        onPrev={() => { advance(-1); pause(); setTimeout(resume, 100); }}
        onNext={() => { advance(1); pause(); setTimeout(resume, 100); }}
      />
    </section>
  );
}
