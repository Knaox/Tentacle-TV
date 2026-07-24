import type { ReactNode } from "react";
import { useCardSpotlight } from "./useCardSpotlight";

interface CardFrameProps {
  hovered: boolean;
  /** Classe de ratio : `aspect-[2/3]` pour une affiche, `aspect-video` pour une vignette. */
  aspect: string;
  /** Amplitude du lift — la vignette 16:9 étant plus large, elle monte moins. */
  lift?: { scale: number; y: number };
  /**
   * Le liseré et le halo répondent au survol, mais la carte NE BOUGE PAS.
   *
   * Réservé aux cartes dont un panneau d'aperçu prend le relais : c'est lui qui
   * porte le lift. Sans ce mode, la carte se soulevait dès l'entrée du curseur
   * puis retombait d'un coup à l'ouverture du panneau — deux mouvements
   * contradictoires en moins de deux dixièmes de seconde, ressentis comme une
   * saccade. Ici le liseré donne une réponse INSTANTANÉE au survol (donc pas
   * d'impression de latence pendant le délai d'ouverture) et le seul
   * déplacement visible est celui du panneau.
   */
  suppressLift?: boolean;
  children: ReactNode;
}

/**
 * Cadre de survol commun à toutes les cartes média — la signature visuelle du
 * catalogue, définie à UN seul endroit :
 *
 *  1. un liseré DÉGRADÉ violet → rose, calque débordant de 2 px sous l'image
 *     (un `box-shadow: 0 0 0 2px` ne sait produire qu'une couleur unie) ;
 *  2. un halo qui suit le curseur (`useCardSpotlight`, purement CSS) ;
 *  3. un lift à ressort et une élévation qui passe à `--elev-card-hover`.
 *
 * Le `transform` vit sur le conteneur EXTÉRIEUR pour que le liseré et l'image
 * bougent ensemble ; le placer sur l'image seule les désynchroniserait.
 */
export function CardFrame({
  hovered,
  aspect,
  lift = { scale: 1.04, y: -6 },
  suppressLift = false,
  children,
}: CardFrameProps) {
  const spot = useCardSpotlight();
  const moved = hovered && !suppressLift;

  return (
    <div
      className="media-tile relative motion-reduce:!transform-none"
      style={{ transform: moved ? `scale(${lift.scale}) translateY(${lift.y}px)` : "scale(1)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-[2px] rounded-[14px] transition-opacity duration-300 motion-reduce:transition-none"
        style={{ background: "var(--card-ring-gradient)", opacity: hovered ? 1 : 0 }}
      />

      <div
        ref={spot.ref}
        data-lit={spot.lit}
        {...spot.handlers}
        className={`card-spotlight relative ${aspect} overflow-hidden rounded-[var(--radius-lg)] transition-[box-shadow] duration-300 motion-reduce:transition-none`}
        style={{
          boxShadow: hovered ? "var(--elev-card-hover), var(--card-ring-glow)" : "var(--elev-1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
