import { memo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useCardMarkers } from "@tentacle-tv/api-client";
import { formatCommunityRating, type CardStatusKind, type MediaItem } from "@tentacle-tv/shared";
import { BookmarkGlyph, HeartGlyph, StarGlyph, WatchedGlyph } from "../cards/cardGlyphs";
import { ON_MEDIA_ACCENT } from "./onMedia";
import { fadeUp } from "../../theme/motion";

interface DetailScorelineProps {
  item: MediaItem;
  /** Note globale à afficher (fiche épisode : TMDB). `undefined` = celle de l'item. */
  communityRating?: number | null;
  /**
   * `false` : aucune requête — la fiche d'un titre gardé ne lit que ce que
   * porte son DTO local (la note, la coche « vu »).
   */
  markersEnabled?: boolean;
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
export const DetailScoreline = memo(function DetailScoreline({ item, communityRating, markersEnabled = true }: DetailScorelineProps) {
  const { t } = useTranslation(["cards", "media"]);
  const markers = useCardMarkers(item, {
    communityRating: communityRating === undefined ? (item.CommunityRating ?? null) : communityRating,
    scope: "item",
    enabled: markersEnabled,
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
          {/* L'étoile à l'encre : la note se lit, elle ne se décore plus d'un dégradé. */}
          <StarGlyph className="h-5 w-5 text-on-media-primary" />
          <span aria-hidden className="font-display text-[1.625rem] font-bold leading-none tabular-nums tracking-tight text-on-media-primary">
            {formatCommunityRating(community)}
          </span>
          <span aria-hidden className="self-end pb-0.5 text-xs font-medium text-on-media-secondary">/10</span>
        </span>
      )}

      {statuses.length > 0 && (
        <ul className="flex flex-wrap items-center gap-2">
          {statuses.map((kind) => {
            const Glyph = STATUS_GLYPH[kind];
            return (
              <li key={kind} className="lg-status-pill chip chip-on-media h-7 px-2.5">
                {/* Un état ACTIF : la teinte franche, la même pour les trois. */}
                <Glyph filled className={`h-3.5 w-3.5 ${ON_MEDIA_ACCENT}`} />
                {t(`cards:status.${kind}`)}
              </li>
            );
          })}
        </ul>
      )}
    </motion.div>
  );
});
