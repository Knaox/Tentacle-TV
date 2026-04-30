interface RowScrollControlsProps {
  canLeft: boolean;
  canRight: boolean;
  onScroll: (direction: "left" | "right") => void;
}

/**
 * Left/right scroll controls overlaid on a horizontal row.
 * Buttons fade in on row hover; chevrons stay neutral white (no brand color)
 * to fit the cinematic Netflix aesthetic.
 */
export function RowScrollControls({ canLeft, canRight, onScroll }: RowScrollControlsProps) {
  return (
    <>
      {canLeft && (
        <button
          type="button"
          onClick={() => onScroll("left")}
          aria-label="Défiler à gauche"
          className="absolute bottom-12 left-0 top-0 z-20 flex w-12 items-center justify-center text-white opacity-0 transition-opacity duration-200 group-hover/row:opacity-100 md:w-16"
          style={{ background: "linear-gradient(to right, rgba(0,0,0,0.65), transparent)" }}
        >
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      {canRight && (
        <button
          type="button"
          onClick={() => onScroll("right")}
          aria-label="Défiler à droite"
          className="absolute bottom-12 right-0 top-0 z-20 flex w-12 items-center justify-center text-white opacity-0 transition-opacity duration-200 group-hover/row:opacity-100 md:w-16"
          style={{ background: "linear-gradient(to left, rgba(0,0,0,0.65), transparent)" }}
        >
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </>
  );
}
