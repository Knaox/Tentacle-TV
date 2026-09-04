import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { formatDuration } from "@tentacle-tv/shared";
import type { MediaItem, MediaStream } from "@tentacle-tv/shared";
import { StarIcon, QualityBadge } from "../media/MediaDetailIcons";
import { extractMediaQuality } from "../../lib/mediaQuality";
import { PremiumQualityBadges } from "../media/PremiumQualityBadges";

interface DetailMetadataProps {
  item: MediaItem;
  streams: MediaStream[];
  /** Note globale à afficher à la place de celle de Jellyfin (fiche épisode :
   *  TMDB). `undefined` = celle de l'item, `null` = aucune. */
  communityRating?: number | null;
}

const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } };

/**
 * Year / rating / runtime / season info / quality badges / genres.
 * Pure presentation; no mutations or navigation.
 *
 * Détection qualité centralisée dans extractMediaQuality — même logique que
 * le badge overlay du hero, pour éviter les divergences (ex : Dolby Vision
 * affiché en "HDR" simple côté metadata).
 */
export function DetailMetadata({ item, streams: _streams, communityRating }: DetailMetadataProps) {
  const { t } = useTranslation("common");
  const community = communityRating === undefined ? item.CommunityRating : communityRating;
  const isSeries = item.Type === "Series";
  const runtime = formatDuration(item.RunTimeTicks);
  const quality = extractMediaQuality(item);

  return (
    <>
      {/* Rangée méta : encore posée sur le scrim de la bannière (le bloc
          remonte en -mt-48) → tokens on-media constants, comme le titre.
          Les chips genres et le synopsis, eux, tombent sur le fond de page
          et restent thémés. */}
      <motion.div
        variants={fadeUp}
        className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-on-media-secondary drop-shadow-[0_1px_4px_var(--on-media-shadow)]"
      >
        {item.ProductionYear && <span className="font-medium">{item.ProductionYear}</span>}
        {item.OfficialRating && (
          <span className="rounded border border-on-media-muted px-1.5 py-0.5 text-[10px] font-bold tracking-wider">
            {item.OfficialRating}
          </span>
        )}
        {community != null && community > 0 && (
          <span className="flex items-center gap-1 font-medium">
            <StarIcon /> {community.toFixed(1)}
          </span>
        )}
        {runtime && <span>{runtime}</span>}
        {isSeries && item.ChildCount != null && (
          <span>{item.ChildCount} {t("common:seasons")}</span>
        )}
        {isSeries && item.Status && (
          <span
            className="rounded px-2 py-0.5 text-[11px] text-on-media-secondary"
            style={{ background: "rgba(var(--scrim-media-rgb), 0.45)" }}
          >
            {item.Status === "Continuing" ? t("common:ongoing") : t("common:ended")}
          </span>
        )}
        <PremiumQualityBadges quality={quality} compact />
        {quality.surroundLabel && <QualityBadge label={quality.surroundLabel} />}
      </motion.div>

      {item.Genres && item.Genres.length > 0 && (
        <motion.div variants={fadeUp} className="mt-3 flex flex-wrap gap-2">
          {item.Genres.map((g) => (
            <span
              key={g}
              className="rounded-full border border-line-subtle bg-fill-subtle px-3 py-1 text-xs text-content-tertiary"
            >
              {g}
            </span>
          ))}
        </motion.div>
      )}
    </>
  );
}
