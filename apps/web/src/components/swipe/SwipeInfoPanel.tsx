import { useTranslation } from "react-i18next";
import type { SwipeCardDetails } from "@tentacle-tv/api-client";

interface SwipeInfoPanelProps {
  title: string;
  format: string;
  details: SwipeCardDetails | undefined;
}

/**
 * Le verso : le synopsis sur un voile noir quasi opaque. Pas de
 * `backdrop-filter` — derrière 0,88 d'alpha, un flou ne se verrait pas et
 * coûterait une passe de composition (règle GPU du dépôt).
 */
export function SwipeInfoPanel({ title, format, details }: SwipeInfoPanelProps) {
  const { t } = useTranslation("swipe");
  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-black/[0.88] px-6 pb-20 pt-8 text-white motion-safe:animate-[fadeIn_0.18s_ease-out_both]">
      <h2 className="text-xl font-bold leading-tight">{title}</h2>
      <p className="mt-1 text-sm text-white/70">{format}</p>
      {/* Le synopsis défile sans emporter la carte : le glisser ne démarre
          pas ici (pointerdown arrêté), et le doigt y garde le défilement. */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="mt-4 min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain pr-1 text-[0.95rem] leading-relaxed text-white/90"
      >
        {details === undefined ? (
          <div className="space-y-2" aria-hidden>
            <div className="h-3.5 w-full rounded bg-white/10" />
            <div className="h-3.5 w-11/12 rounded bg-white/10" />
            <div className="h-3.5 w-4/5 rounded bg-white/10" />
          </div>
        ) : (
          <p>{details.overview || t("noOverview")}</p>
        )}
      </div>
    </div>
  );
}
