import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Info, Play, Star } from "lucide-react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { WatchedGlyph } from "../../components/cards/cardGlyphs";
import { useIsTablet } from "../useMirrorLayout";
import { CascadeGroup } from "./CascadeGroup";
import { HERO_CTA_ROW, HERO_INFO_STYLE, TEXT_SHADOW, TITLE_SHADOW, heroInfoClass, heroPlayClass } from "./heroCta";

export function formatRuntime(ticks: number): string {
  const mins = Math.round(ticks / 600_000_000);
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${m}` : `${h}h`;
}

/**
 * `HeroContent` de l'app (`HeroBannerContent.tsx`) : étiquettes (« Reprendre »,
 * « Vu », S01E02 · titre), logo 280×92 ou titre 32 extra-gras (46 sur
 * tablette, logo 380×124), méta 13 (année, classement, note, durée, deux
 * genres), synopsis 2 lignes (3 et 17 px sur tablette), progression au
 * dégradé de marque, puis « Lire / Reprendre » et « Plus d'infos ».
 */
export function HeroContent({ item, active, onPlay, onInfo }: {
  item: MediaItem;
  active: boolean;
  onPlay: (item: MediaItem) => void;
  onInfo: (item: MediaItem) => void;
}) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const isTablet = useIsTablet();
  const [logoBroken, setLogoBroken] = useState(false);
  const isEpisode = item.Type === "Episode";
  const logoId = isEpisode && item.SeriesId ? item.SeriesId : item.Id;
  const logoUrl =
    item.ImageTags?.Logo != null && !logoBroken ? client.getImageUrl(logoId, "Logo", { width: 500, quality: 90 }) : null;
  const displayName = isEpisode ? (item.SeriesName ?? item.Name) : item.Name;
  const episodeLabel = isEpisode
    ? `S${String(item.ParentIndexNumber ?? 1).padStart(2, "0")}E${String(item.IndexNumber ?? 1).padStart(2, "0")} · ${item.Name}`
    : null;
  const progress = item.UserData?.PlayedPercentage ?? 0;
  const hasProgress = progress > 0 && progress < 100;
  const isWatched = item.UserData?.Played === true;
  const genres = item.Genres?.slice(0, 2) ?? [];
  const runtime = item.RunTimeTicks ? formatRuntime(item.RunTimeTicks) : null;
  const playLabel = hasProgress ? t("resume") : t("play");

  return (
    <div>
      <CascadeGroup order={0} active={active}>
        {(hasProgress || isWatched || episodeLabel) && (
          <div className="mb-3 flex flex-wrap items-center gap-2.5">
            {(hasProgress || isWatched) && (
              <span className="flex items-center gap-[5px] rounded-[3px] bg-cta-primary-bg px-[7px] py-[3px] text-[9.5px] font-extrabold uppercase tracking-[1.6px] text-cta-primary-fg">
                {/* « Vu » : le glyphe du modèle des cartes, pas une coche à part. */}
                {hasProgress ? <Play size={9} fill="currentColor" aria-hidden /> : <WatchedGlyph className="h-2.5 w-2.5" filled />}
                {hasProgress ? t("continueLabel") : t("watched")}
              </span>
            )}
            {episodeLabel && (
              <span className="truncate text-[13px] font-medium tracking-[0.2px] text-on-media-secondary">{episodeLabel}</span>
            )}
          </div>
        )}
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={displayName}
            draggable={false}
            onError={() => setLogoBroken(true)}
            className="max-w-[85%] object-contain object-left"
            style={isTablet ? { width: 380, height: 124, marginBottom: 18 } : { width: 280, height: 92, marginBottom: 14 }}
          />
        ) : (
          <h2
            className="line-clamp-3 font-extrabold text-on-media-primary"
            style={{
              fontSize: isTablet ? 46 : 32,
              lineHeight: isTablet ? "52px" : "36px",
              marginBottom: isTablet ? 18 : 14,
              letterSpacing: -0.6,
              textShadow: TITLE_SHADOW,
            }}
          >
            {displayName}
          </h2>
        )}
      </CascadeGroup>

      <CascadeGroup order={1} active={active}>
        <div className="mb-2.5 flex flex-wrap items-center gap-[9px] text-[13px]">
          {item.ProductionYear != null && <span className="font-semibold text-on-media-secondary">{item.ProductionYear}</span>}
          {item.OfficialRating != null && (
            <span className="rounded-[3px] border border-on-media-muted px-[5px] text-[9px] font-bold tracking-[0.6px] text-on-media-secondary">
              {item.OfficialRating}
            </span>
          )}
          {item.CommunityRating != null && (
            <span className="flex items-center gap-[3px] font-semibold text-status-warning-fg">
              <Star size={11} aria-hidden />
              {item.CommunityRating.toFixed(1)}
            </span>
          )}
          {runtime && <span className="font-semibold text-on-media-secondary">{runtime}</span>}
          {genres.map((g) => (
            <span key={g} className="font-medium text-on-media-secondary">· {g}</span>
          ))}
        </div>
        {item.Overview != null && (
          <p
            className={`mb-[18px] text-on-media-secondary ${isTablet ? "line-clamp-3 text-[17px] leading-[25px]" : "line-clamp-2 text-[15px] leading-[21px]"}`}
            style={{ textShadow: TEXT_SHADOW }}
          >
            {item.Overview}
          </p>
        )}
        {hasProgress && (
          <div className="mb-[18px] flex max-w-[280px] items-center gap-2.5">
            <div className="h-[3px] flex-1 overflow-hidden rounded-sm bg-fill-strong">
              <div
                className="h-full rounded-sm"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, var(--brand), var(--brand-accent))",
                  boxShadow: "0 0 5px rgba(var(--brand-accent-rgb), 0.55)",
                }}
              />
            </div>
            <span className="text-[11px] font-bold text-on-media-secondary">{Math.round(progress)}%</span>
          </div>
        )}
      </CascadeGroup>

      <CascadeGroup order={2} active={active}>
        <div className={HERO_CTA_ROW}>
          <button type="button" onClick={() => onPlay(item)} className={heroPlayClass(isTablet)} aria-label={`${playLabel} ${item.Name}`}>
            <Play size={20} fill="currentColor" aria-hidden />
            {playLabel}
          </button>
          <button
            type="button"
            onClick={() => onInfo(item)}
            className={heroInfoClass(isTablet)}
            style={HERO_INFO_STYLE}
            aria-label={`${t("moreInfo")} ${item.Name}`}
          >
            <Info size={16} aria-hidden />
            {t("moreInfo")}
          </button>
        </div>
      </CascadeGroup>
    </div>
  );
}
