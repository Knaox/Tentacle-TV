import { memo, useId } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useCardMarkers } from "@tentacle-tv/api-client";
import { formatCommunityRating, STAR_PATH, STAR_VIEWBOX, type CardStatusKind, type MediaItem } from "@tentacle-tv/shared";
import { BookmarkGlyph, HeartGlyph, WatchedGlyph } from "../cards/cardGlyphs";
import { fadeUp } from "../../theme/motion";

interface DetailScorelineProps {
  item: MediaItem;
  /** Note globale à afficher (fiche épisode : TMDB). `undefined` = celle de l'item. */
  communityRating?: number | null;
}

const STATUS_GLYPH: Record<CardStatusKind, typeof BookmarkGlyph> = {
  watchlist: BookmarkGlyph,
  favorite: HeartGlyph,
  watched: WatchedGlyph,
};

/**
 * La note et les marqueurs de la fiche, dans la grammaire des cartes : la note
 * du public en grand, puis les états vrais — signet, cœur, coche — dans le même ordre et avec les mêmes
 * tracés que la pastille des affiches. Ce qu'on a vu sur la carte, on le
 * retrouve ici, simplement plus grand.
 *
 * Les BASCULES restent dans la capsule d'actions : ici on lit, on ne touche pas.
 */
export const DetailScoreline = memo(function DetailScoreline({ item, communityRating }: DetailScorelineProps) {
  const { t } = useTranslation(["cards", "media"]);
  const gradientId = useId();
  const markers = useCardMarkers(item, {
    communityRating: communityRating === undefined ? (item.CommunityRating ?? null) : communityRating,
    scope: "item",
  });
  // Votre note n'est pas répétée ici : le contrôle d'étoiles de la rangée
  // d'actions l'affiche déjà, et c'est là qu'on la change.
  const { communityRating: community, statuses } = markers;
  if (community === null && statuses.length === 0) return null;

  return (
    <motion.div variants={fadeUp} className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
      {community !== null && (
        <span
          className="flex items-center gap-2 drop-shadow-[0_2px_8px_var(--on-media-shadow)]"
          aria-label={t("cards:communityRating", { score: formatCommunityRating(community) })}
          title={t("media:detailCommunityScore")}
        >
          <svg className="h-6 w-6" viewBox={STAR_VIEWBOX} aria-hidden>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="var(--brand-light)" />
                <stop offset="1" stopColor="var(--brand-accent)" />
              </linearGradient>
            </defs>
            <path d={STAR_PATH} fill={`url(#${gradientId})`} />
          </svg>
          <span aria-hidden className="text-[1.75rem] font-bold leading-none tabular-nums tracking-tight text-on-media-primary">
            {formatCommunityRating(community)}
          </span>
          <span aria-hidden className="self-end pb-0.5 text-xs font-medium text-on-media-muted">/10</span>
        </span>
      )}

      {statuses.length > 0 && (
        <ul className="flex flex-wrap items-center gap-2">
          {statuses.map((kind) => {
            const Glyph = STATUS_GLYPH[kind];
            return (
              <li
                key={kind}
                className="flex items-center gap-1.5 rounded-full border border-on-media-muted px-3 py-1 text-xs font-medium text-on-media-secondary"
                style={{ background: "rgba(var(--scrim-media-rgb), 0.35)" }}
              >
                <Glyph filled className={`h-3.5 w-3.5 ${kind === "favorite" ? "text-[var(--brand-accent)]" : "text-[var(--brand-light)]"}`} />
                {t(`cards:status.${kind}`)}
              </li>
            );
          })}
        </ul>
      )}
    </motion.div>
  );
});
