import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useJellyfinClient, useSeriesWatchState } from "@tentacle-tv/api-client";
import { formatDuration, formatEpisodeCode } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { PlayIcon, StarIcon } from "../icons/HeroIcons";
import { extractMediaQuality } from "../../lib/mediaQuality";
import { RichOverview } from "../../lib/overviewHtml";
import { LanguagePill, QualityChips, hasQualityChips, soberMetaText } from "../media/MetaChips";

interface HeroContentProps {
  item: MediaItem;
  animationKey: number;
}

/**
 * Hero text/CTAs for a single item.
 * Receives `animationKey` so re-mounting (on slide change) replays the entrance animation.
 */
export function HeroContent({ item, animationKey }: HeroContentProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const { data: watchState } = useSeriesWatchState(item.Type === "Series" ? item.Id : undefined);

  const isEpisode = item.Type === "Episode";
  const isSeries = item.Type === "Series";
  const logoId = isEpisode && item.SeriesId ? item.SeriesId : item.Id;
  const logoUrl = item.ImageTags?.Logo
    ? client.getImageUrl(logoId, "Logo", { width: 500, quality: 90 })
    : isEpisode && item.SeriesId
      ? client.getImageUrl(item.SeriesId, "Logo", { width: 500, quality: 90 })
      : null;

  const displayName = isEpisode ? (item.SeriesName ?? item.Name) : item.Name;
  // Le code S/E va sur le bouton Reprendre/Lecture (compact) — plus de titre
  // d'épisode dans le mini-tag (trop coûteux en espace sur la bannière).
  const resumeEp = isEpisode
    ? item
    : (isSeries && watchState?.type !== "completed" ? watchState?.episode : undefined);
  const buttonEpisodeCode = resumeEp
    ? formatEpisodeCode(resumeEp.ParentIndexNumber, resumeEp.IndexNumber)
    : null;

  const runtime = formatDuration(item.RunTimeTicks);
  const progress = item.UserData?.PlayedPercentage ?? 0;
  const hasProgress = progress > 0 && progress < 100;
  const quality = useMemo(() => extractMediaQuality(item), [item]);
  // Pour un épisode, la qualité/langues va en version sobre à droite de la
  // ligne titre (la rangée méta est déjà bien remplie). Films/séries : chips.
  const episodeSoberMeta = isEpisode ? soberMetaText(quality) : "";

  const handlePlay = () => {
    if (isSeries) {
      const epId = watchState?.type !== "completed" ? watchState?.episode?.Id : undefined;
      navigate(epId ? `/watch/${epId}` : `/media/${item.Id}`);
    } else {
      navigate(`/watch/${item.Id}`);
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-[15%] z-10 px-4 sm:px-8 md:bottom-[18%] md:px-14 lg:bottom-[20%]">
      <div
        key={animationKey}
        className="max-w-xl"
        style={{ animation: "fadeSlideUp 0.7s var(--ease-out, ease-out) both" }}
      >
        {/* Mini-tag row above the title */}
        {(hasProgress || episodeSoberMeta) && (
          <div className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em]">
            {hasProgress && (
              <span className="text-white/85">
                <span className="text-white">▶</span> {t("common:continueLabel")}
              </span>
            )}
            {episodeSoberMeta && (
              <span className="text-white/45 tracking-[0.12em]">{episodeSoberMeta}</span>
            )}
          </div>
        )}

        {/* Logo / Title — bornés à la colonne hero (max-w-xl du parent) pour
            ne jamais déborder vers les flèches du carrousel à droite. */}
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={displayName}
            className="mb-4 h-20 max-w-[440px] object-contain object-left drop-shadow-[0_4px_24px_var(--surface-overlay)] md:h-28 lg:h-32"
            draggable={false}
          />
        ) : (
          <h1
            className="mb-4 font-bold text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)] line-clamp-2 break-words tracking-tight"
            style={{
              fontSize: "clamp(1.75rem, 3.6vw, 3.25rem)",
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
            }}
          >
            {displayName}
          </h1>
        )}

        {/* Metadata row */}
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-white/85">
          {item.ProductionYear && <span className="font-medium">{item.ProductionYear}</span>}
          {item.OfficialRating && (
            <span className="rounded border border-white/30 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white/70">
              {item.OfficialRating}
            </span>
          )}
          {item.CommunityRating && (
            <span className="flex items-center gap-1 font-medium">
              <StarIcon /> {item.CommunityRating.toFixed(1)}
            </span>
          )}
          {runtime && <span className="text-white/70">{runtime}</span>}
          {item.Genres?.slice(0, 3).map((g) => (
            <span key={g} className="text-white/65">· {g}</span>
          ))}
          {/* Qualité + langues — chips inline pour films/séries. Pour un épisode,
              la rangée serait trop chargée : la méta passe en version sobre à
              droite de la ligne titre (cf. episodeSoberMeta au-dessus). */}
          {!isEpisode && (
            <>
              {(hasQualityChips(quality) || quality.audioLabels.length > 0) && (
                <span aria-hidden className="mx-1 text-white/30">·</span>
              )}
              <span className="flex items-center gap-1.5">
                <QualityChips quality={quality} density="full" />
                <LanguagePill labels={quality.audioLabels} max={4} />
              </span>
            </>
          )}
        </div>

        {/* Overview — clamped to 2 lines (max-w-xl du parent borne la largeur)
            pour que la description reste strictement dans la colonne hero. */}
        {item.Overview && (
          <p className="mb-6 hidden text-base leading-relaxed text-white/85 line-clamp-2 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] sm:block">
            <RichOverview text={item.Overview} />
          </p>
        )}

        {/* Progress bar — slim, beneath overview when applicable */}
        {hasProgress && (
          <div className="mb-5 flex max-w-md items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-medium text-white/70">{Math.round(progress)}%</span>
          </div>
        )}

        {/* CTA — Play unique sur la bannière (pas de bouton « Plus d'infos » ici). */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePlay}
            className="flex items-center gap-2.5 rounded-md bg-white px-7 py-3 text-base font-bold text-black transition-all duration-200 hover:scale-[1.03] hover:bg-white/90"
            style={{ boxShadow: "0 8px 30px rgba(var(--brand-rgb), 0.35), 0 0 0 1px rgba(255,255,255,0.7) inset" }}
          >
            <PlayIcon />
            {hasProgress ? t("common:resume") : t("common:play")}
            {buttonEpisodeCode && <span className="font-semibold text-black/60">{buttonEpisodeCode}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
