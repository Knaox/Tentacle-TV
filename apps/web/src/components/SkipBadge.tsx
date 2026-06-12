export interface SkipFlash {
  delta: number;
  id: number;
}

/**
 * Badge éphémère « +30s / −10s » après un saut (boutons ±10/30, flèches
 * clavier, swipe) — pilule latérale côté du sens du saut, façon Netflix.
 */
export function SkipBadge({ flash }: { flash: SkipFlash | null }) {
  if (!flash) return null;
  const forward = flash.delta > 0;
  const label = forward ? `+${flash.delta}s` : `−${Math.abs(flash.delta)}s`;

  return (
    <div
      key={flash.id}
      className={`pointer-events-none absolute top-[45%] z-30 ${forward ? "right-10 md:right-24" : "left-10 md:left-24"}`}
    >
      <div className="flex animate-[fadeIn_0.12s_ease] items-center gap-2 rounded-full border border-white/15 bg-black/65 px-5 py-2.5 backdrop-blur-sm">
        {!forward && (
          <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M11 18V6l-8.5 6L11 18zm.5-6l8.5 6V6l-8.5 6z" />
          </svg>
        )}
        <span className="text-lg font-extrabold tabular-nums text-white">{label}</span>
        {forward && (
          <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M13 6v12l8.5-6L13 6zm-.5 6L4 6v12l8.5-6z" />
          </svg>
        )}
      </div>
    </div>
  );
}
