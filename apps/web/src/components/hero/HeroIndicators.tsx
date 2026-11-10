import { useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ChevronLeftIcon, ChevronRightIcon } from "../icons/HeroIcons";
import { AMBIENT_HZ } from "../../theme/motion";

interface HeroIndicatorsProps {
  count: number;
  activeIndex: number;
  /** Durée d'un slide en ms — anime le remplissage de la pastille active (0 = statique). */
  durationMs?: number;
  /** Le nom de chaque diapositive, lu par les lecteurs d'écran sur sa pastille. */
  labels?: readonly string[];
  /**
   * D'avant la refonte de nov. 2026, quand les flèches n'étaient montées qu'au survol : elles
   * sont désormais TOUJOURS là. Gardés pour les appelants (le carrousel des recommandations).
   */
  arrowsMounted?: boolean;
  arrowsShown?: boolean;
  onSelect: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * Flèches et pastilles de la bannière. Présentation pure : la minuterie vit chez l'appelant
 * (`useBillboardRotation`), et la pastille active en est la JAUGE — même départ, même durée,
 * mêmes paliers que le voyage de l'image (`hero-fill`, theme/heroMotion.css) : quand elle est
 * pleine, la diapositive suivante arrive.
 *
 * Les flèches sont TOUJOURS là (Damien, nov. 2026 : montées au survol seulement, on ne pouvait
 * plus faire défiler le carrousel là où le survol ne vient pas). Elles flottent sur une image
 * qui voyage sans fin : un disque d'ENCRE, sans `backdrop-filter` — un flou y serait refait à
 * chaque palier du voyage, à l'écran en permanence. Pour la même raison elles ne passent pas
 * par la primitive de verre, même sous le verre natif.
 *
 * Posés sur l'affiche : encre et ivoire CONSTANTS dans les deux thèmes (règle « posé sur média »).
 */
const ARROW =
  "icon-btn absolute top-1/2 z-10 -mt-6 h-12 w-12 rounded-full bg-[rgba(19,19,21,0.55)] text-on-media-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-[rgba(19,19,21,0.8)] hover:text-on-media-primary focus-visible:outline-on-media-primary";

export function HeroIndicators({ count, activeIndex, durationMs = 0, labels, onSelect, onPrev, onNext }: HeroIndicatorsProps) {
  const { t } = useTranslation("common");
  const reduced = useReducedMotion();
  if (count <= 1) return null;

  // Joué par le compositeur, au rythme du voyage de la diapositive : leurs pas tombent ensemble.
  const animateFill = durationMs > 0 && !reduced;
  const fillAnimation = animateFill
    ? `hero-fill ${durationMs}ms steps(${Math.max(1, Math.round((AMBIENT_HZ * durationMs) / 1000))}, end) both`
    : undefined;

  return (
    <>
      <button type="button" data-hero-step="prev" onClick={onPrev} aria-label={t("common:previous")} className={`${ARROW} left-3 md:left-4`}>
        <ChevronLeftIcon />
      </button>
      <button type="button" data-hero-step="next" onClick={onNext} aria-label={t("common:next")} className={`${ARROW} right-3 md:right-4`}>
        <ChevronRightIcon />
      </button>

      <div role="group" aria-label={t("common:featuredTitles")} className="absolute bottom-3 right-4 z-10 flex items-center md:bottom-7 md:right-10">
        {Array.from({ length: count }).map((_, i) => {
          const active = i === activeIndex;
          return (
            // La cible fait 24 px de haut ; le trait qu'on voit, 4. Un trait de 4 px ne se visait pas.
            <button
              key={i}
              type="button"
              onClick={() => onSelect(i)}
              aria-label={labels?.[i] || t("common:slideNumber", { index: i + 1 })}
              aria-current={active}
              className="group/dot flex h-6 items-center px-[3px] outline-none"
            >
              <span
                className={`relative block h-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.34)] group-focus-visible/dot:outline group-focus-visible/dot:outline-2 group-focus-visible/dot:outline-offset-2 group-focus-visible/dot:outline-on-media-primary ${
                  active ? "w-10" : "w-2 group-hover/dot:bg-[rgba(255,255,255,0.6)]"
                }`}
              >
                {active && (
                  <span
                    key={activeIndex}
                    aria-hidden
                    className="absolute inset-0 origin-left rounded-full bg-on-media-primary"
                    style={{ animation: fillAnimation }}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
