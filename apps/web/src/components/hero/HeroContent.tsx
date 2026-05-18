import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useJellyfinClient, useSeriesWatchState } from "@tentacle-tv/api-client";
import { formatDuration } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { PlayIcon, StarIcon } from "../icons/HeroIcons";
import { extractMediaQuality } from "../../lib/mediaQuality";
import { PremiumChip, DolbyChip } from "../media/CardMetaOverlay";
import { CountryFlag } from "../media/CountryFlag";

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
  const episodeLabel = isEpisode
    ? `S${item.ParentIndexNumber ?? "?"}E${item.IndexNumber ?? "?"} · ${item.Name}`
    : null;

  const runtime = formatDuration(item.RunTimeTicks);
  const progress = item.UserData?.PlayedPercentage ?? 0;
  const hasProgress = progress > 0 && progress < 100;
  const quality = useMemo(() => extractMediaQuality(item), [item]);

  const detailId = isEpisode && item.SeriesId ? item.SeriesId : item.Id;

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
        {(hasProgress || episodeLabel) && (
          <div className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em]">
            {hasProgress && (
              <span className="text-white/85">
                <span className="text-white">▶</span> {t("common:continueLabel")}
              </span>
            )}
            {episodeLabel && (
              <span className="text-white/55 normal-case tracking-normal">{episodeLabel}</span>
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
          <h1 className="mb-4 text-display-3 font-bold text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)] line-clamp-2 break-words md:text-display-2 lg:text-display-1">
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
          {/* Qualité + drapeaux audio inline — alimentés par extractMediaQuality
              comme les cards, mais rendus sans positioning absolu pour
              s'insérer dans la rangée meta. */}
          {(quality.resolution || quality.isHEVC || quality.isDolbyVision ||
            quality.isHDR || quality.isDolbyAtmos || quality.isDolbyDigital) && (
            <span aria-hidden className="mx-1 text-white/30">·</span>
          )}
          {quality.resolution === "4K" && <PremiumChip label="4K" tone="accent" />}
          {quality.resolution === "FHD" && <PremiumChip label="1080P" tone="glass" />}
          {quality.resolution === "HD" && <PremiumChip label="720P" tone="glass" />}
          {quality.isHEVC && <PremiumChip label="HEVC" tone="glass" title="HEVC / H.265" />}
          {quality.isDolbyVision && <DolbyChip label="VISION" />}
          {!quality.isDolbyVision && quality.isHDR && <PremiumChip label="HDR" tone="glass" />}
          {quality.isDolbyAtmos && <DolbyChip label="ATMOS" />}
          {!quality.isDolbyAtmos && quality.isDolbyDigital && <DolbyChip label="DIGITAL" />}
          {quality.audioFlags.slice(0, 4).map((f) => (
            <CountryFlag
              key={`${f.countryCode}-${f.secondaryCountryCode ?? ""}`}
              code={f.countryCode}
              secondary={f.secondaryCountryCode}
              languageCode={f.languageCode}
            />
          ))}
        </div>

        {/* Overview — clamped to 2 lines (max-w-xl du parent borne la largeur)
            pour que la description reste strictement dans la colonne hero. */}
        {item.Overview && (
          <p className="mb-6 hidden text-base leading-relaxed text-white/85 line-clamp-2 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] sm:block">
            {item.Overview}
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

        {/* CTAs — white Play with subtle Tentacle violet halo, ghost More Info */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePlay}
            className="flex items-center gap-2.5 rounded-md bg-white px-7 py-3 text-base font-bold text-black transition-all duration-200 hover:scale-[1.03] hover:bg-white/90"
            style={{ boxShadow: "0 8px 30px rgba(var(--brand-rgb), 0.35), 0 0 0 1px rgba(255,255,255,0.7) inset" }}
          >
            <PlayIcon />
            {hasProgress ? t("common:resume") : t("common:play")}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/media/${detailId}`)}
            className="flex items-center gap-2.5 rounded-md px-6 py-3 text-base font-semibold text-white transition-all duration-200 hover:scale-[1.03]"
            style={{
              background: "rgba(var(--brand-rgb), 0.18)",
              border: "1px solid rgba(var(--brand-rgb), 0.35)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
            }}
          >
            <span aria-hidden>ⓘ</span>
            {t("common:moreInfo")}
          </button>
        </div>
      </div>
    </div>
  );
}
