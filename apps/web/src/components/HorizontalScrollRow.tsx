import type { CSSProperties, ReactNode } from "react";
import { useHorizontalScroll } from "../hooks/useHorizontalScroll";
import { useHoverMount } from "../hooks/useHoverMount";

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
 * Horizontally scrollable strip with chevron controls that fade
 * in on hover. Multi-input: wheel, drag, touch, click-the-chevron, keyboard
 * focus + arrow keys. Chevrons appear only when the content actually overflows.
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
        style={{ overscrollBehaviorX: "contain", scrollBehavior: "smooth", ...innerStyle }}
      >
        {children}
      </div>

      {chevrons.mounted && (
        <>
          <ChevronEdge side="left" visible={canLeft} shown={chevrons.hovered} onClick={() => scrollBy("left")} />
          <ChevronEdge side="right" visible={canRight} shown={chevrons.hovered} onClick={() => scrollBy("right")} />
        </>
      )}
    </div>
  );
}

/**
 * Un chevron n'existe QUE quand il sert : la piste déborde de ce côté (`visible`)
 * ET le curseur est sur la rangée. Il est `aria-hidden` et hors du parcours de
 * tabulation — la navigation clavier passe par les flèches sur le conteneur —,
 * son démontage ne retire donc rien à personne.
 */
function ChevronEdge({
  side,
  visible,
  shown,
  onClick,
}: {
  side: "left" | "right";
  visible: boolean;
  shown: boolean;
  onClick: () => void;
}) {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={-1}
      aria-hidden="true"
      data-shown={shown}
      className={[
        "hover-reveal pointer-events-auto absolute top-0 bottom-0 z-20 flex w-10 items-center",
        side === "left" ? "left-0 justify-start pl-1" : "right-0 justify-end pr-1",
      ].join(" ")}
      style={{
        "--reveal-ms": "150ms",
        background:
          side === "left"
            ? "linear-gradient(to right, rgba(8,8,18,0.85), rgba(8,8,18,0))"
            : "linear-gradient(to left, rgba(8,8,18,0.85), rgba(8,8,18,0))",
      } as CSSProperties}
    >
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full bg-fill-soft text-content-primary ring-1 ring-line-strong backdrop-blur-sm transition-transform duration-150 hover:bg-fill-medium hover:scale-105"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          {side === "left" ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          )}
        </svg>
      </span>
    </button>
  );
}
