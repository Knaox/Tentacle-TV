import type { CSSProperties, ReactNode } from "react";
import { useHorizontalScroll } from "../hooks/useHorizontalScroll";

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
 * Horizontally scrollable strip with Netflix-style chevron controls that fade
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

  return (
    <div className={`group/scroll relative ${wrapperClassName}`}>
      <div
        ref={ref}
        role="group"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); scrollBy("right"); }
          else if (e.key === "ArrowLeft") { e.preventDefault(); scrollBy("left"); }
        }}
        className={`flex overflow-x-auto scrollbar-hide outline-none rounded-md focus-visible:ring-2 focus-visible:ring-white/30 ${className}`}
        style={{ overscrollBehaviorX: "contain", scrollBehavior: "smooth", ...innerStyle }}
      >
        {children}
      </div>

      <ChevronEdge side="left" visible={canLeft} onClick={() => scrollBy("left")} />
      <ChevronEdge side="right" visible={canRight} onClick={() => scrollBy("right")} />
    </div>
  );
}

function ChevronEdge({
  side,
  visible,
  onClick,
}: {
  side: "left" | "right";
  visible: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={-1}
      aria-hidden="true"
      className={[
        "pointer-events-auto absolute top-0 bottom-0 z-20 flex w-10 items-center",
        side === "left" ? "left-0 justify-start pl-1" : "right-0 justify-end pr-1",
        "opacity-0 transition-opacity duration-150 ease-out",
        visible ? "group-hover/scroll:opacity-100 focus-visible:opacity-100" : "pointer-events-none",
      ].join(" ")}
      style={{
        background:
          side === "left"
            ? "linear-gradient(to right, rgba(8,8,18,0.85), rgba(8,8,18,0))"
            : "linear-gradient(to left, rgba(8,8,18,0.85), rgba(8,8,18,0))",
      }}
    >
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 backdrop-blur-sm transition-transform duration-150 hover:bg-white/20 hover:scale-105"
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
