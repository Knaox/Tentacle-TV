import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cardRatingFor, formatDuration, formatEpisodeCode } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { CardQuickActions } from "./CardQuickActions";
import { CardDownloadAction } from "../../downloads/CardDownloadAction";
import { LanguagePill, QualityChips } from "../media/MetaChips";
import { StarIcon } from "../icons/HeroIcons";
import { useSeriesRatingMap } from "./SeriesRatingContext";
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
  /**
   * Version resserrée, pour le voile superposé qui n'a que la hauteur de la
   * carte : pas de synopsis, pas de rangée d'actions (elle vit alors dans le
   * coin de la vignette), et le code d'épisode replié dans la ligne méta.
   *
   * Empilés, titre + actions + code + méta faisaient quatre rangées dans 194 px
   * de carte : le voile mangeait plus de la moitié de l'image, et l'aperçu ne
   * montrait plus grand-chose du média qu'il est censé faire voir.
   */
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
  // La même note que le badge de l'affiche, par la même règle : un lot en a
  // désormais une — celle de sa série — là où il n'affichait rien.
  const { rating } = cardRatingFor(item, "series", useSeriesRatingMap());

  const onMedia = tone === "media";
  const metaClass = onMedia ? "text-on-media-secondary" : "text-content-tertiary";
  const labelClass = onMedia ? "text-on-media-secondary" : "text-content-quaternary";
  // Mise en avant (% visionné, nombre d'épisodes ajoutés) en ROSE, pas en violet
  // — même teinte que les barres de progression. Blanc quand le bloc est posé
  // sur l'image (mode `media`).
  const highlightClass = onMedia ? "text-on-media-primary" : "text-[var(--brand-accent-light)]";

  const metaLine = (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] ${metaClass}`}>
      {/* En version resserrée le code d'épisode rejoint cette ligne au lieu
          d'occuper la sienne — une rangée gagnée sur quatre. */}
      {epLabel && compact && (
        <span className={`font-bold uppercase tracking-[0.12em] ${labelClass}`}>{epLabel}</span>
      )}
      {addedCount > 1 ? (
        <span className={`font-medium ${highlightClass}`}>
          {t("common:addedEpisodes", { count: addedCount })}
        </span>
      ) : (
        <>
          {item.ProductionYear && <span className="font-medium">{item.ProductionYear}</span>}
        </>
      )}
      {/* La note, elle, vaut AUSSI pour un lot : c'est celle de la série, et un
          lot est précisément une série. Seuls l'année, la durée et le
          pourcentage restent sans objet pour un groupe d'épisodes. */}
      {rating != null && (
        <span className="flex items-center gap-0.5 font-medium">
          <span aria-hidden className="text-[var(--brand-accent)]">
            <StarIcon />
          </span>
          {rating.toFixed(1)}
        </span>
      )}
      {addedCount <= 1 && (
        <>
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
  );

  // ── Version resserrée (voile sur l'image, disposition `overlay`) ──────────
  // Hauteur libre, pas de synopsis ni d'actions : comportement d'origine.
  if (compact) {
    return (
      <div
        className="flex cursor-pointer flex-col gap-2 px-3 pb-3 pt-2"
        data-preview-info
        role="link"
        aria-label={t("common:moreInfo")}
        onClick={onOpenDetail}
      >
        {metaLine}
      </div>
    );
  }

  // ── Tiroir du panneau (disposition `down`) ────────────────────────────────
  return (
    <div
      className="flex cursor-pointer flex-col gap-2 px-3 pb-3 pt-2.5"
      data-preview-info
      role="link"
      aria-label={t("common:moreInfo")}
      onClick={onOpenDetail}
    >
      {/* Le CTA de lecture n'est pas ici : la vignette lance déjà la lecture,
          et le bouton « Plus d'infos » vit dans son coin haut-gauche. */}
      <div className="flex items-center gap-1.5">
        <CardQuickActions item={item} variant="bar" />
        {/* La racine du tiroir ouvre la fiche : le bouton coupe la
            propagation lui-même, sinon télécharger naviguerait. */}
        <CardDownloadAction item={item} variant="bar" />
      </div>

      {epLabel && (
        <p className={`text-[10px] font-bold uppercase tracking-[0.16em] ${labelClass}`}>
          {epLabel}
        </p>
      )}

      {/* Ligne méta. Un lot d'épisodes n'a ni année, ni durée, ni progression
          propres : on annonce alors leur nombre. Sa NOTE, en revanche, existe
          désormais — c'est celle de la série, que `cardRatingFor` résout comme
          pour le badge de l'affiche. */}
      {metaLine}

      {/* Synopsis : UNE ligne, tronquée par « … » (`line-clamp-1`) — pas de
          défilement. Un aperçu doit rester court ; la phrase entière est sur la
          fiche, à un clic. */}
      {item.Overview && (
        <p className="line-clamp-1 text-[11px] leading-relaxed text-content-secondary">
          <RichOverview text={item.Overview} />
        </p>
      )}
    </div>
  );
}
