import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import type { SwipeCard, SwipeCardDetails } from "@tentacle-tv/api-client";
import { SwipeCardRecto } from "./SwipeCardRecto";
import { SwipeInfoPanel } from "./SwipeInfoPanel";

interface SwipeCardFaceProps {
  card: SwipeCard;
  posterUrl: string | null;
  /** Carte du dessus : elle seule porte le bouton d'info et le verso. */
  interactive: boolean;
  infoOpen: boolean;
  details: SwipeCardDetails | undefined;
  onToggleInfo: () => void;
}

/**
 * Une carte : l'affiche plein cadre, son texte (SwipeCardRecto) et, à la
 * demande, le verso (synopsis) — MONTÉ quand on l'ouvre, jamais laissé à
 * opacité nulle.
 */
export const SwipeCardFace = memo(function SwipeCardFace({
  card,
  posterUrl,
  interactive,
  infoOpen,
  details,
  onToggleInfo,
}: SwipeCardFaceProps) {
  const { t } = useTranslation("swipe");
  const [broken, setBroken] = useState(false);
  const format = [
    card.mediaType === "movie" ? t("movie") : t("series"),
    card.year ? String(card.year) : null,
    details?.runtimeMinutes ? t("runtime", { minutes: details.runtimeMinutes }) : null,
    details?.seasons ? t("seasons", { count: details.seasons }) : null,
  ].filter(Boolean);
  const title = details?.title || card.title;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[1.75rem] border border-white/10 bg-surface-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]">
      {posterUrl && !broken ? (
        <img
          src={posterUrl}
          alt=""
          draggable={false}
          decoding="async"
          onError={() => setBroken(true)}
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] p-8 text-center text-2xl font-bold text-white">
          {title}
        </div>
      )}

      {/* Verso ouvert : le texte du recto s'efface — sous le voile, il
          transparaissait en fantôme. L'affiche seule reste dessous. */}
      {!(interactive && infoOpen) && (
        <SwipeCardRecto card={card} title={title} format={format.join(" · ")} withInfoButton={interactive} />
      )}

      {interactive && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleInfo();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-expanded={infoOpen}
          aria-label={infoOpen ? t("hideInfo") : t("showInfo")}
          title={infoOpen ? t("hideInfo") : t("showInfo")}
          className="absolute bottom-4 right-4 z-20 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <Info size={20} aria-hidden />
        </button>
      )}

      {interactive && infoOpen && <SwipeInfoPanel title={title} format={format.join(" · ")} details={details} />}
    </div>
  );
});
