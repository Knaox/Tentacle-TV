import { memo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { cardRatingFor, resolvePosterImage, type MediaItem } from "@tentacle-tv/shared";
import { CardRatingBadge } from "../../components/cards/CardRatingBadge";
import { useSeriesRatingMap } from "../../components/cards/SeriesRatingContext";
import { ProgressBar } from "../ui/ProgressBar";
import { Pressable } from "../ui/Pressable";
import { useCardWidth } from "../useMirrorLayout";

interface Props {
  item: MediaItem;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Largeur imposée (grilles) ; sinon celle des rangées (130 / 168 × densité). */
  width?: number;
  /** Titre en petit (11) sous les affiches de grille. */
  small?: boolean;
}

/**
 * L'affiche 2:3 de l'app (`MobileMediaCard`) : rayon 12, ombre elev2, lettre
 * de repli, progression en bas à 6 du bord, coche blanche des vus en haut à
 * droite, note en bas à gauche, badge « +N » dégradé d'un lot d'épisodes.
 * Titre 13 semi-gras à 8 dessous, année 10 en tertiaire.
 */
export const MediaCard = memo(function MediaCard({ item, onPress, onLongPress, width, small = false }: Props) {
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const { t } = useTranslation("common");
  const rowWidth = useCardWidth();
  const cardWidth = width ?? rowWidth;
  const [broken, setBroken] = useState(false);

  const isEpisode = item.Type === "Episode";
  const addedCount = item.RecentlyAddedCount ?? 0;
  const grouped = addedCount > 1;
  const resolved = resolvePosterImage(item, "series");
  const poster =
    resolved && !broken
      ? client.getImageUrl(resolved.id, resolved.type, { width: 300, quality: 80, ...(resolved.tag ? { tag: resolved.tag } : {}) })
      : null;
  const progress = item.UserData?.PlayedPercentage ?? 0;
  const hasProgress = progress > 0 && progress < 100;
  const watched = item.UserData?.Played === true;
  const { rating } = cardRatingFor(item, "series", useSeriesRatingMap());

  return (
    <Pressable
      onPress={onPress ?? (() => navigate(`/media/${item.Id}`))}
      onLongPress={onLongPress}
      style={{ width: cardWidth }}
      aria-label={`${item.Name}${item.ProductionYear ? `, ${item.ProductionYear}` : ""}`}
    >
      <div
        className="relative aspect-[2/3] rounded-xl bg-surface-2"
        style={{ boxShadow: "0 4px 6px rgba(0,0,0,0.22)" }}
      >
        <div className="absolute inset-0 overflow-hidden rounded-xl bg-surface-2">
          {poster ? (
            <img
              src={poster}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              onError={() => setBroken(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-4xl font-extrabold tracking-[-0.5px] text-content-disabled">
              {item.Name?.charAt(0).toUpperCase() ?? "?"}
            </span>
          )}
        </div>
        {hasProgress && <ProgressBar progress={progress / 100} className="absolute inset-x-1.5 bottom-1.5" />}
        {watched && !hasProgress && (
          <span
            className="absolute right-[7px] top-[7px] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-cta-primary-bg text-cta-primary-fg"
            style={{ boxShadow: "0 2px 4px rgba(0,0,0,0.35)" }}
          >
            <Check size={12} strokeWidth={3} aria-hidden />
          </span>
        )}
        <CardRatingBadge rating={rating} className="bottom-1.5 left-1.5" />
        {grouped && (
          <span
            className="absolute left-[7px] top-[7px] rounded-md px-1.5 py-[3px] text-[11px] font-bold leading-3 text-cta-brand-fg"
            style={{
              background: "linear-gradient(135deg, var(--brand), var(--brand-accent))",
              boxShadow: "0 2px 8px rgba(var(--brand-rgb), 0.45)",
            }}
          >
            +{addedCount}
          </span>
        )}
      </div>
      <p className={`mt-2 truncate font-semibold tracking-[-0.1px] text-content-primary ${small ? "text-[11px]" : "text-[13px]"}`}>
        {isEpisode && item.IndexNumber != null
          ? `S${String(item.ParentIndexNumber ?? 1).padStart(2, "0")}E${String(item.IndexNumber).padStart(2, "0")} · `
          : ""}
        {item.Name}
      </p>
      {grouped && <p className="mt-0.5 text-[10px] font-medium text-content-tertiary">{t("addedEpisodes", { count: addedCount })}</p>}
      {!grouped && !isEpisode && item.ProductionYear != null && (
        <p className="mt-0.5 text-[10px] font-medium text-content-tertiary">{item.ProductionYear}</p>
      )}
      {isEpisode && item.SeriesName != null && (
        <p className="mt-0.5 truncate text-[10px] font-medium text-content-tertiary">{item.SeriesName}</p>
      )}
    </Pressable>
  );
});
