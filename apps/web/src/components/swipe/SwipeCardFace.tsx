import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Info, Sparkles, Star, TrendingUp, Compass } from "lucide-react";
import type { SwipeCard, SwipeCardDetails } from "@tentacle-tv/api-client";
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
 * Le recto d'une carte : l'affiche plein cadre, et dessous, sur un dégradé
 * noir constant (posé sur média), le titre, le format, les genres, la
 * présence en bibliothèque et la raison de la proposition. Le verso
 * (synopsis) se MONTE à la demande — jamais laissé à opacité nulle.
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

      {/* Coin haut : l'origine de la carte et sa note. Blanc/noir constants. */}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
        {card.source !== "taste" ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-black/65 px-2.5 py-1 text-xs font-semibold text-white">
            {card.source === "popular" ? <TrendingUp size={13} aria-hidden /> : <Compass size={13} aria-hidden />}
            {card.source === "popular" ? t("sourcePopular") : t("sourceExplore")}
          </span>
        ) : (
          <span />
        )}
        {card.voteAverage != null && card.voteAverage > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-black/65 px-2.5 py-1 text-xs font-semibold tabular-nums text-white">
            <Star size={12} className="fill-current text-amber-300" aria-hidden />
            {card.voteAverage.toFixed(1)}
          </span>
        )}
      </div>

      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pb-5 pl-5 pt-24 text-white ${
          interactive ? "pr-16" : "pr-5"
        }`}
      >
        <h2 className="text-2xl font-bold leading-tight [text-wrap:balance]">{title}</h2>
        <p className="mt-1 text-sm text-white/80">{format.join(" · ")}</p>
        {card.genres.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {card.genres.map((g) => (
              <li key={g} className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs font-medium">
                {g}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-col gap-1 text-xs font-medium text-white/85">
          <span className="inline-flex items-center gap-1.5">
            {card.jellyfinItemId ? <Check size={14} aria-hidden /> : <span className="h-1.5 w-1.5 rounded-full bg-white/60" aria-hidden />}
            {card.jellyfinItemId ? t("inLibrary") : t("notInLibrary")}
          </span>
          {card.reason && (
            <span className="inline-flex items-center gap-1.5">
              <Sparkles size={14} aria-hidden />
              <span className="truncate">{t("reason", { title: card.reason })}</span>
            </span>
          )}
        </div>
      </div>

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
