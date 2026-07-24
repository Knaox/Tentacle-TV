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

  // ── Tiroir du panneau (disposition `down`) — HAUTEUR FIXE ─────────────────
  // `h-full` : le tiroir parent (`HoverPreviewBody`) impose `DRAWER_HEIGHT`, ce
  // bloc le remplit. La zone haute est fixe ; le synopsis prend le reste et
  // défile, si bien que la hauteur TOTALE ne bouge ni avec ni sans synopsis.
  return (
    <div
      className="flex h-full cursor-pointer flex-col px-3 pb-3 pt-2.5"
      data-preview-info
      role="link"
      aria-label={t("common:moreInfo")}
      onClick={onOpenDetail}
    >
      <div className="flex flex-shrink-0 flex-col gap-2">
        {/* Le CTA de lecture n'est pas ici : la vignette lance déjà la lecture,
            et le bouton « Plus d'infos » vit dans son coin haut-gauche. */}
        <div className="flex items-center gap-1.5">
          <CardQuickActions item={item} variant="bar" />
        </div>

        {epLabel && (
          <p className={`text-[10px] font-bold uppercase tracking-[0.16em] ${labelClass}`}>
            {epLabel}
          </p>
        )}

        {/* Ligne méta. Un lot d'épisodes n'a ni note ni durée propres : on
            annonce alors le nombre d'épisodes plutôt qu'une ligne vide. */}
        {metaLine}
      </div>

      {/* Synopsis : UNE ligne visible, le reste DÉFILE (`overflow-y-auto`), sans
          barre (`scrollbar-hide`) et avec un fondu bas (`mask-image`) qui signale
          la suite. `max-h` le borne à ~1,5 ligne — une ligne pleine plus l'amorce
          fondue de la suivante. Le panneau reste court. Absent, la zone
          disparaît ; la hauteur totale, imposée par le parent, ne bouge pas. */}
      {item.Overview && (
        <div
          className="scrollbar-hide mt-1.5 max-h-[24px] min-h-0 flex-1 overflow-y-auto overscroll-contain"
          style={{
            maskImage: "linear-gradient(180deg, #000 calc(100% - 9px), transparent 100%)",
            WebkitMaskImage: "linear-gradient(180deg, #000 calc(100% - 9px), transparent 100%)",
          }}
        >
          <p className="text-[11px] leading-relaxed text-content-secondary">
            <RichOverview text={item.Overview} />
          </p>
        </div>
      )}
    </div>
  );
}
