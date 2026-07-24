import { useState, useEffect, useCallback, useRef } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import { HeroAmbilight } from "./HeroAmbilight";
import { HeroBackdrop, HERO_ZOOM_DURATION_S } from "./HeroBackdrop";
import { HeroContent } from "./HeroContent";
import { HeroIndicators } from "./HeroIndicators";
import { useDataSaverActive } from "../../offline/useDataSaver";

/**
 * Hauteur de la carte. Réduite depuis le passage au cadre : à fond perdu elle
 * pouvait occuper 92 vh puisqu'elle commençait sous la barre de navigation et
 * se fondait dans la page. Encadrée, elle démarre SOUS la nav et doit laisser
 * voir son cadre en bas — sans quoi il n'y a plus de cadre, juste une bannière
 * aux coins arrondis.
 */
const CARD_HEIGHT = "h-[62vh] md:h-[70vh] lg:h-[76vh]";
/** Gouttière du cadre = celle des rangées : le bord gauche de la bannière tombe
 *  alors exactement sur la première affiche de chaque rangée. */
const FRAME_GUTTER = "px-[var(--row-gutter-mobile)] md:px-[var(--row-gutter-desktop)]";

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
  const dataSaver = useDataSaverActive();
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
    // Mode économie : hero figé. Chaque rotation charge un backdrop 1920px
    // sans lazy ni préchargement (~250-400 Ko), et rien n'est mis en cache :
    // 5 min passées sur l'accueil coûtent jusqu'à ~10 Mo en pure perte.
    // La navigation manuelle (flèches, indicateurs) reste disponible.
    if (dataSaver) return;
    if (rotateMs > 0 && items.length > 1 && !pausedRef.current) {
      timerRef.current = setInterval(() => advance(1), rotateMs);
    }
  }, [rotateMs, items.length, advance, dataSaver]);

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
    return <div className={`w-full ${CARD_HEIGHT}`} />;
  }

  // NB: pas de onMouseEnter={pause}/onMouseLeave={resume} sur la section —
  // le hero couvre ~90vh, le curseur le survole quasi en permanence, ce qui
  // figeait le carrousel à la première slide. Le timer continue de tourner ;
  // l'utilisateur peut toujours interrompre via les flèches / indicateurs
  // (qui font un pause éphémère 100ms pour absorber le clic).
  return (
    // Le CADRE : fond de page, gouttières de rangée. Aucun `overflow-hidden`
    // ici — le halo doit pouvoir déborder de la carte sur le fond, c'est tout
    // l'effet. `bg-surface-0` et non un noir littéral : en thème clair le cadre
    // doit être nacré comme la page, pas une bande sombre autour d'elle.
    <section
      className={`relative w-full bg-surface-0 pb-6 md:pb-10 ${FRAME_GUTTER}`}
      aria-label="Featured content"
    >
      <div className="relative">
        {/* Halo, DERRIÈRE la carte : il occupe exactement sa surface et sa
            lumière s'échappe tout autour. */}
        <HeroAmbilight items={items} activeIndex={index} />

        {/* La carte. Repère de la transition d'ouverture : c'est ce cadre que
            « Plus d'infos » fait s'ouvrir jusqu'au plein écran de la fiche. */}
        <div
          data-hero-frame
          className={`group/billboard relative w-full overflow-hidden ${CARD_HEIGHT}`}
          style={{
            borderRadius: "var(--hero-frame-radius)",
            boxShadow: "var(--hero-frame-ring)",
          }}
        >
          <HeroBackdrop items={items} activeIndex={index} />
          <HeroContent item={items[index]} animationKey={animKey} />
          <HeroIndicators
            count={items.length}
            activeIndex={index}
            durationMs={rotateMs}
            onSelect={(i) => { goTo(i); pause(); setTimeout(resume, 100); }}
            onPrev={() => { advance(-1); pause(); setTimeout(resume, 100); }}
            onNext={() => { advance(1); pause(); setTimeout(resume, 100); }}
          />
        </div>
      </div>
    </section>
  );
}
