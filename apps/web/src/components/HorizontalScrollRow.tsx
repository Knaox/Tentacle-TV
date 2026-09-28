import type { CSSProperties, ReactNode } from "react";
import { useHorizontalScroll } from "../hooks/useHorizontalScroll";
import { useHoverMount } from "../hooks/useHoverMount";
import { EdgeArrows } from "./scroll/EdgeArrows";
import { edgeFadeMask } from "./scroll/edgeFade";

interface HorizontalScrollRowProps {
  children: ReactNode;
  /** Classes applied to the inner scrolling strip. */
  className?: string;
  /** Classes applied to the outer wrapper (positioning, spacing). */
  wrapperClassName?: string;
  /** Extra inline style on the inner scroll container. */
  innerStyle?: CSSProperties;
  /** Accessible label announced to screen readers (e.g. "Season tabs"). */
  ariaLabel?: string;
}

/**
 * Bande qui défile à l'horizontale : molette, glisser, doigt, flèches au
 * survol, touches fléchées au clavier. Là où elle continue, son bord s'efface
 * (masque) et une flèche en disque de verre paraît au survol — ni l'un ni
 * l'autre quand le contenu tient.
 */
export function HorizontalScrollRow({
  children,
  className = "",
  wrapperClassName = "",
  innerStyle,
  ariaLabel,
}: HorizontalScrollRowProps) {
  const { ref, canLeft, canRight, scrollBy } = useHorizontalScroll();
  // Les chevrons portent un `backdrop-filter` : montés à la demande plutôt que
  // laissés à `opacity: 0`, où leur flou continue d'être recalculé. Le cas le
  // plus coûteux n'est pas la fiche média mais les panneaux du LECTEUR
  // (sélecteur d'épisodes), où l'arrière-plan est une vidéo en cours de
  // lecture : le flou y serait refait à chaque image décodée.
  // 150 ms = le tempo de la classe Tailwind remplacée.
  const chevrons = useHoverMount(150);

  return (
    <div
      className={`group/scroll relative ${wrapperClassName}`}
      onMouseEnter={chevrons.onMouseEnter}
      onMouseLeave={chevrons.onMouseLeave}
    >
      <div
        ref={ref}
        role="group"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); scrollBy("right"); }
          else if (e.key === "ArrowLeft") { e.preventDefault(); scrollBy("left"); }
        }}
        className={`flex overflow-x-auto scrollbar-hide outline-none rounded-md focus-visible:ring-2 focus-visible:ring-line-strong ${className}`}
        style={{ overscrollBehaviorX: "contain", scrollBehavior: "smooth", ...edgeFadeMask(canLeft, canRight), ...innerStyle }}
      >
        {children}
      </div>

      <EdgeArrows canLeft={canLeft} canRight={canRight} mounted={chevrons.mounted} shown={chevrons.hovered} onScroll={scrollBy} />
    </div>
  );
}
