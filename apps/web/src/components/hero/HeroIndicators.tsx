import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeftIcon, ChevronRightIcon } from "../icons/HeroIcons";
import { PressableScale } from "../ui/PressableScale";

interface HeroIndicatorsProps {
  count: number;
  activeIndex: number;
  /** Durée d'un slide en ms — anime le remplissage de la pastille active (0 = statique). */
  durationMs?: number;
  onSelect: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * Slide indicators (pills bottom-right) + prev/next arrows (visible on hover).
 * Pure presentation — all timer logic lives in HeroBillboard. La pastille
 * active se remplit sur la durée du slide (façon stories), calée sur le timer
 * de rotation du billboard.
 */
export function HeroIndicators({ count, activeIndex, durationMs = 0, onSelect, onPrev, onNext }: HeroIndicatorsProps) {
  const reduced = useReducedMotion();
  if (count <= 1) return null;

  const animateFill = durationMs > 0 && !reduced;

  // Flèches et pastilles flottent directement sur le backdrop image du hero :
  // fond noir translucide + icônes blanches volontairement constants dans les
  // deux thèmes (contrôles superposés à l'image, cf. règle « posé sur média »).
  const arrowClass =
    "absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur-sm transition-[opacity,background-color] duration-300 hover:bg-black/60 group-hover/billboard:opacity-100";

  return (
    <>
      <PressableScale
        hoverScale={1.05}
        tapScale={0.92}
        onClick={onPrev}
        aria-label="Précédent"
        className={`${arrowClass} left-3 md:left-6`}
      >
        <ChevronLeftIcon />
      </PressableScale>

      <PressableScale
        hoverScale={1.05}
        tapScale={0.92}
        onClick={onNext}
        aria-label="Suivant"
        className={`${arrowClass} right-3 md:right-6`}
      >
        <ChevronRightIcon />
      </PressableScale>

      <div className="absolute bottom-6 right-6 z-10 flex items-center gap-1.5 md:bottom-10 md:right-10">
        {Array.from({ length: count }).map((_, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(i)}
              aria-label={`Slide ${i + 1}`}
              className="relative h-[3px] overflow-hidden rounded-full transition-all duration-500"
              style={{
                width: active ? 36 : 12,
                background: "var(--on-media-muted)",
                boxShadow: active ? "0 0 12px rgba(var(--brand-rgb), 0.55)" : "none",
              }}
            >
              {active && (
                <motion.span
                  key={activeIndex}
                  initial={animateFill ? { scaleX: 0 } : false}
                  animate={{ scaleX: 1 }}
                  transition={animateFill ? { duration: durationMs / 1000, ease: "linear" } : { duration: 0 }}
                  className="absolute inset-0 origin-left rounded-full"
                  style={{ background: "linear-gradient(90deg, var(--brand), var(--brand-light))" }}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
