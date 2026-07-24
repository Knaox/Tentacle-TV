import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatDuration, formatEpisodeCode } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { CardQuickActions } from "./CardQuickActions";
import { LanguagePill, QualityChips } from "../media/MetaChips";
import { StarIcon } from "../icons/HeroIcons";
import { extractMediaQuality } from "../../lib/mediaQuality";
import { RichOverview } from "../../lib/overviewHtml";

interface HoverPreviewInfoProps {
  item: MediaItem;
  /**
   * Sur quoi le bloc repose.
   *  • `panel` — le tiroir déroulé sous la vignette : fond de panneau thémé,
   *    donc texte en tokens de contenu ;
   *  • `media` — posé SUR l'image (disposition superposée) : blanc constant
   *    dans les deux schémas, comme tout ce qui est posé sur un visuel. Des
   *    tokens de contenu y deviendraient du texte sombre sur voile sombre en
   *    thème clair.
   */
  tone?: "panel" | "media";
  /** Sans synopsis : la version superposée n'a que la hauteur de la carte. */
  compact?: boolean;
  /** Ouverture de la fiche — le bloc est cliquable dans son intégralité. */
  onOpenDetail: (e: React.MouseEvent) => void;
}

/**
 * Bloc d'informations du panneau d'aperçu : actions rapides, code d'épisode,
 * ligne méta, synopsis.
 *
 * Extrait de `HoverPreviewBody` quand celui-ci a dû gérer deux dispositions
 * (règle des 300 lignes). La séparation est nette : ce fichier ne connaît que le
 * CONTENU, `HoverPreviewBody` ne s'occupe que de sa place et de son animation.
 *
 * Bloc ENTIÈREMENT cliquable vers la fiche détail — l'image, elle, lance la
 * lecture. Deux zones, deux intentions, chacune avec son propre curseur : le
 * panneau n'a donc pas besoin d'un bouton « Plus d'infos » séparé.
 */
export function HoverPreviewInfo({
  item,
  tone = "panel",
  compact = false,
  onOpenDetail,
}: HoverPreviewInfoProps) {
  const { t } = useTranslation("common");

  const isEpisode = item.Type === "Episode";
  const quality = useMemo(() => extractMediaQuality(item), [item]);
  const runtime = formatDuration(item.RunTimeTicks);
  const epLabel = isEpisode ? formatEpisodeCode(item.ParentIndexNumber, item.IndexNumber) : null;
  const addedCount = item.RecentlyAddedCount ?? 0;
  const progress = item.UserData?.PlayedPercentage;
  const hasProgress = progress != null && progress > 0 && progress < 99;

  const onMedia = tone === "media";
  const metaClass = onMedia ? "text-on-media-secondary" : "text-content-tertiary";
  const labelClass = onMedia ? "text-on-media-secondary" : "text-content-quaternary";
  const highlightClass = onMedia ? "text-on-media-primary" : "text-[var(--brand-light)]";

  return (
    <div
      className={`flex cursor-pointer flex-col gap-2 px-3 pb-3 ${compact ? "pt-2" : "pt-2.5"}`}
      data-preview-info
      role="link"
      aria-label={t("common:moreInfo")}
      onClick={onOpenDetail}
    >
      {/* Le CTA de lecture n'est pas ici : c'est l'icône posée en haut à gauche
          de la vignette, qui sert de repère au survol sans masquer l'image. */}
      <div className="flex items-center gap-1.5">
        <CardQuickActions item={item} variant="bar" />
      </div>

      {epLabel && (
        <p className={`text-[10px] font-bold uppercase tracking-[0.16em] ${labelClass}`}>
          {epLabel}
        </p>
      )}

      {/* Ligne méta. Un lot d'épisodes n'a ni note ni durée propres : on annonce
          alors le nombre d'épisodes, plutôt que de laisser la ligne vide. */}
      <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] ${metaClass}`}>
        {addedCount > 1 ? (
          <span className={`font-medium ${highlightClass}`}>
            {t("common:addedEpisodes", { count: addedCount })}
          </span>
        ) : (
          <>
            {item.ProductionYear && <span className="font-medium">{item.ProductionYear}</span>}
            {item.CommunityRating != null && (
              <span className="flex items-center gap-0.5 font-medium">
                <StarIcon /> {item.CommunityRating.toFixed(1)}
              </span>
            )}
            {runtime && <span>{runtime}</span>}
            {hasProgress && (
              <span className={`font-medium ${highlightClass}`}>
                {t("common:percentWatched", { percent: Math.round(progress) })}
              </span>
            )}
          </>
        )}
        <span className="flex items-center gap-1">
          <QualityChips quality={quality} density="compact" />
          <LanguagePill labels={quality.audioLabels} max={2} />
        </span>
      </div>

      {!compact && item.Overview && (
        <p className="line-clamp-2 text-[11px] leading-relaxed text-content-secondary">
          <RichOverview text={item.Overview} />
        </p>
      )}
    </div>
  );
}
