import { ChevronLeftIcon, ChevronRightIcon } from "../icons/HeroIcons";

interface HeroIndicatorsProps {
  count: number;
  activeIndex: number;
  onSelect: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * Slide indicators (pills bottom-right) + prev/next arrows (visible on hover).
 * Pure presentation — all timer logic lives in HeroBillboard.
 */
export function HeroIndicators({ count, activeIndex, onSelect, onPrev, onNext }: HeroIndicatorsProps) {
  if (count <= 1) return null;

  return (
    <>
      <button
        type="button"
        onClick={onPrev}
        aria-label="Précédent"
        className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white opacity-0 transition-all duration-300 hover:bg-black/60 group-hover/billboard:opacity-100 md:left-6"
        style={{
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <ChevronLeftIcon />
      </button>

      <button
        type="button"
        onClick={onNext}
        aria-label="Suivant"
        className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white opacity-0 transition-all duration-300 hover:bg-black/60 group-hover/billboard:opacity-100 md:right-6"
        style={{
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <ChevronRightIcon />
      </button>

      <div className="absolute bottom-6 right-6 z-10 flex items-center gap-1.5 md:bottom-10 md:right-10">
        {Array.from({ length: count }).map((_, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(i)}
              aria-label={`Slide ${i + 1}`}
              className="h-[3px] rounded-full transition-all duration-500"
              style={{
                width: active ? 36 : 12,
                background: active
                  ? "linear-gradient(90deg, #8B5CF6, #A78BFA)"
                  : "rgba(255,255,255,0.28)",
                boxShadow: active ? "0 0 12px rgba(139,92,246,0.55)" : "none",
              }}
            />
          );
        })}
      </div>
    </>
  );
}
