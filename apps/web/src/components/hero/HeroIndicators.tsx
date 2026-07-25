import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeftIcon, ChevronRightIcon } from "../icons/HeroIcons";
import { PressableScale } from "../ui/PressableScale";
import { AMBIENT_HZ, cadence } from "../../theme/motion";

interface HeroIndicatorsProps {
  count: number;
  activeIndex: number;
  /** Durée d'un slide en ms — anime le remplissage de la pastille active (0 = statique). */
  durationMs?: number;
  /**
   * Les flèches sont-elles DANS le DOM ? Piloté par `useHoverMount` chez
   * l'appelant : vrai pendant le survol, et le temps du fondu de sortie.
   */
  arrowsMounted?: boolean;
  /** Cible du fondu — vrai tant que le curseur est sur la bannière. */
  arrowsShown?: boolean;
  onSelect: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * Flèches (au survol) et rail d'indicateurs de la bannière. Présentation pure :
 * toute la logique de minuterie vit dans `HeroBillboard`. Le segment actif se
 * remplit sur la durée du slide, façon stories, calé sur ce même timer.
 *
 * Ces contrôles flottent directement sur l'affiche : verre sombre et icônes
 * blanches sont donc CONSTANTS dans les deux thèmes (règle « posé sur média »),
 * mais le liseré et le halo suivent la marque.
 */
export function HeroIndicators({
  count,
  activeIndex,
  durationMs = 0,
  arrowsMounted = false,
  arrowsShown = false,
  onSelect,
  onPrev,
  onNext,
}: HeroIndicatorsProps) {
  const reduced = useReducedMotion();
  // Remplissage bridé comme les autres mouvements d'ambiance : quarante-quatre
  // pixels parcourus en huit secondes, soit moins de deux dixièmes de pixel par
  // pas à trente images par seconde. Mémoïsé parce qu'une nouvelle identité de
  // fonction d'easing relancerait l'animation à chaque rendu du composant.
  const fillEase = useMemo(
    () => cadence(AMBIENT_HZ, durationMs / 1000),
    [durationMs],
  );
  if (count <= 1) return null;

  const animateFill = durationMs > 0 && !reduced;

  // Le CENTRAGE vertical vit sur un conteneur, jamais sur le bouton lui-même.
  // `PressableScale` est un `motion.button` : au survol, Framer écrit un
  // `transform` inline qui ÉCRASE le `-translate-y-1/2` de Tailwind — la flèche
  // retombait alors d'une demi-hauteur, de façon intermittente (seulement une
  // fois le transform posé). Deux calques, deux responsabilités : le conteneur
  // positionne, le bouton met à l'échelle.
  const zoneClass = "absolute top-1/2 z-10 -translate-y-1/2";
  // `hover-reveal` (theme/reveal.css) porte l'opacité ET les couleurs dans une
  // seule `transition` — les répartir entre une classe Tailwind et la feuille
  // en perdrait une. Les flèches ne sont montées que pendant le survol : elles
  // portent un `backdrop-filter` et flottent sur une image qui zoome sans fin,
  // donc à `opacity: 0` leur flou était malgré tout refait à chaque image.
  const arrowClass =
    "hover-reveal flex h-12 w-12 items-center justify-center rounded-full border border-on-media-muted bg-[rgba(var(--scrim-media-rgb),0.42)] text-on-media-primary backdrop-blur-md hover:border-[rgba(var(--brand-rgb),0.75)] hover:bg-[rgba(var(--scrim-media-rgb),0.62)]";

  return (
    <>
      {arrowsMounted && (
        <>
          <div className={`${zoneClass} left-3 md:left-6`}>
            <PressableScale
              hoverScale={1.06}
              tapScale={0.92}
              onClick={onPrev}
              aria-label="Précédent"
              className={arrowClass}
              data-shown={arrowsShown}
            >
              <ChevronLeftIcon />
            </PressableScale>
          </div>

          <div className={`${zoneClass} right-3 md:right-6`}>
            <PressableScale
              hoverScale={1.06}
              tapScale={0.92}
              onClick={onNext}
              aria-label="Suivant"
              className={arrowClass}
              data-shown={arrowsShown}
            >
              <ChevronRightIcon />
            </PressableScale>
          </div>
        </>
      )}

      <div className="absolute bottom-6 right-6 z-10 flex items-center gap-2 md:bottom-10 md:right-10">
        {Array.from({ length: count }).map((_, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(i)}
              aria-label={`Slide ${i + 1}`}
              aria-current={active}
              className="relative h-1 overflow-hidden rounded-full transition-all duration-500 motion-reduce:transition-none"
              style={{
                width: active ? 44 : 14,
                background: "var(--on-media-muted)",
                boxShadow: active ? "0 0 14px rgba(var(--brand-rgb), 0.6)" : "none",
              }}
            >
              {active && (
                <motion.span
                  key={activeIndex}
                  initial={animateFill ? { scaleX: 0 } : false}
                  animate={{ scaleX: 1 }}
                  transition={animateFill ? { duration: durationMs / 1000, ease: fillEase } : { duration: 0 }}
                  className="absolute inset-0 origin-left rounded-full"
                  style={{ background: "linear-gradient(90deg, var(--brand), var(--brand-accent))" }}
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
