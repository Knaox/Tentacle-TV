import { memo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { useCardMarkers, useJellyfinClient } from "@tentacle-tv/api-client";
import { formatCommunityRating, formatUserScore, STAR_PATH, STAR_VIEWBOX, type CardStatusKind, type MediaItem } from "@tentacle-tv/shared";
import { BookmarkGlyph, HeartGlyph, WatchedGlyph } from "../../../components/cards/cardGlyphs";
import { useThemeMode } from "../../../theme/useThemeMode";
import { MetaTokens } from "./MetaTokens";
import { episodeCode, runtimeMinutes } from "./detailMetrics";

const KIND_KEYS: Partial<Record<MediaItem["Type"], string>> = {
  Movie: "kindMovie", Series: "kindSeries", Season: "kindSeason", BoxSet: "kindCollection",
};
const STATUS_GLYPH: Record<CardStatusKind, typeof BookmarkGlyph> = {
  watchlist: BookmarkGlyph, favorite: HeartGlyph, watched: WatchedGlyph,
};
const SHADOW = { textShadow: "0 1px 6px var(--on-media-shadow)" };

interface Props {
  item: MediaItem;
  /** `center` : posé dans la scène (portrait) ; `start` : colonne gauche de l'iPad paysage. */
  align: "center" | "start";
  logoMaxW: number;
  logoMaxH: number;
}

/**
 * Le bloc titre de la scène — le `StageBlock` de l'app : surtitre, LOGO du
 * titre (le nom en texte à défaut, et toujours pour un épisode), puis la note
 * en grand avec les marqueurs des cartes — votre note comprise, au dégradé de
 * marque comme sur les cartes —, la ligne de faits et les jetons.
 *
 * Posé sur le décor : jetons `on-media` dans les deux thèmes. Chaque ligne
 * entre à son tour (`mirror-detail-in-*`, opacité et transform seulement).
 */
export const StageBlock = memo(function StageBlock({ item, align, logoMaxW, logoMaxH }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const { t: tm } = useTranslation("media");
  const { t: tc } = useTranslation("cards");
  const client = useJellyfinClient();
  const [logoBroken, setLogoBroken] = useState(false);
  const isEpisode = item.Type === "Episode";
  const isSeries = item.Type === "Series";
  const centered = align === "center";
  const { isDark } = useThemeMode();
  // Un logo est dessiné pour un fond sombre : dans la colonne de l'iPad
  // paysage en thème clair (posée sur la page, pas sur le décor), il
  // disparaîtrait — le titre y reste en texte.
  const logoTag = !isEpisode && (centered || isDark) ? item.ImageTags?.Logo : undefined;
  const logo = logoTag && !logoBroken
    ? client.getImageUrl(item.Id, "Logo", { height: logoMaxH * 2, quality: 90, tag: logoTag })
    : null;
  const markers = useCardMarkers(item, { communityRating: item.CommunityRating ?? null, scope: "item" });
  const runtimeMin = runtimeMinutes(item.RunTimeTicks);

  const kicker = isEpisode ? "" : [
    KIND_KEYS[item.Type] ? tm(KIND_KEYS[item.Type] as string) : null,
    isSeries && item.Status ? (item.Status === "Continuing" ? t("ongoing") : t("ended")) : null,
  ].filter(Boolean).join(" · ");
  const facts = [
    item.ProductionYear != null ? String(item.ProductionYear) : null,
    runtimeMin != null && runtimeMin > 0 && item.Type !== "BoxSet" ? t("minutesShort", { count: runtimeMin }) : null,
    isSeries && item.ChildCount ? t("seasonsCount", { count: item.ChildCount }) : null,
  ].filter(Boolean) as string[];

  return (
    <div className={`flex min-w-0 flex-col ${centered ? "items-center text-center" : "items-start"}`}>
      {isEpisode && item.SeriesName && (
        <button
          type="button"
          onClick={() => item.SeriesId && navigate(`/media/${item.SeriesId}`)}
          disabled={!item.SeriesId}
          aria-label={item.SeriesName}
          className="mirror-detail-in-title mirror-detail-fade-press mb-1.5 flex max-w-full items-center gap-1 text-on-media-secondary"
          style={SHADOW}
        >
          <span className="truncate text-[13px] font-semibold uppercase tracking-[1px]">{item.SeriesName}</span>
          {item.SeriesId && <ChevronRight size={14} className="shrink-0" aria-hidden />}
        </button>
      )}
      {kicker !== "" && (
        <p className="mirror-detail-in-title mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[1.6px] text-on-media-secondary" style={SHADOW}>
          <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-accent))" }} />
          {kicker}
        </p>
      )}
      <h1
        className={logo ? "sr-only" : "mirror-detail-in-title line-clamp-3 break-words text-[30px] font-extrabold leading-[33px] tracking-[-0.8px] text-on-media-primary"}
        style={logo ? undefined : SHADOW}
      >
        {isEpisode && item.IndexNumber != null ? `${episodeCode(item.ParentIndexNumber, item.IndexNumber)} · ` : ""}
        {item.Name}
      </h1>
      {logo && (
        <img
          src={logo}
          alt=""
          draggable={false}
          onError={() => setLogoBroken(true)}
          className="mirror-detail-in-logo block h-auto w-auto object-contain"
          style={{
            maxWidth: logoMaxW,
            maxHeight: logoMaxH,
            objectPosition: centered ? "center bottom" : "left bottom",
            transformOrigin: centered ? "center bottom" : "left bottom",
            filter: "drop-shadow(0 4px 16px var(--on-media-shadow))",
          }}
        />
      )}

      <div className={`mirror-detail-in-meta mt-3.5 flex flex-wrap items-center gap-2 ${centered ? "justify-center" : ""}`}>
        {markers.communityRating !== null && (
          <span className="flex items-center gap-1.5" aria-label={tc("communityRating", { score: formatCommunityRating(markers.communityRating) })}>
            <svg className="h-[18px] w-[18px]" viewBox={STAR_VIEWBOX} aria-hidden>
              <path d={STAR_PATH} fill="var(--brand-accent-light)" />
            </svg>
            <span aria-hidden className="text-[20px] font-bold leading-none tabular-nums text-on-media-primary" style={SHADOW}>
              {formatCommunityRating(markers.communityRating)}
            </span>
            <span aria-hidden className="self-end text-[11px] font-medium text-on-media-muted">/10</span>
          </span>
        )}
        {markers.userScore !== null && (
          <span
            role="img"
            aria-label={tc("userRating", { score: formatUserScore(markers.userScore) })}
            className="flex h-7 items-center gap-1 rounded-full px-2.5 text-[13px] font-bold tabular-nums text-cta-brand-fg"
            style={{ background: "linear-gradient(90deg, var(--brand), var(--brand-accent))" }}
          >
            <svg className="h-3 w-3" viewBox={STAR_VIEWBOX} aria-hidden>
              <path d={STAR_PATH} fill="currentColor" />
            </svg>
            {formatUserScore(markers.userScore)}
          </span>
        )}
        {markers.statuses.map((kind) => {
          const Glyph = STATUS_GLYPH[kind];
          return (
            <span
              key={kind}
              role="img"
              aria-label={tc(`status.${kind}`)}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-on-media-muted"
              style={{ background: "rgba(var(--scrim-media-rgb), 0.4)" }}
            >
              <Glyph filled className={`h-3.5 w-3.5 ${kind === "favorite" ? "text-[var(--brand-accent-light)]" : "text-[var(--brand-light)]"}`} />
            </span>
          );
        })}
      </div>

      {(facts.length > 0 || item.OfficialRating) && (
        <p className={`mirror-detail-in-meta mt-2.5 flex flex-wrap items-center gap-x-1.5 text-[13px] font-medium text-on-media-secondary ${centered ? "justify-center" : ""}`} style={SHADOW}>
          {item.OfficialRating && (
            <span className="mr-0.5 rounded-[4px] border border-on-media-muted px-1 py-px text-[10px] font-bold leading-[13px]">{item.OfficialRating}</span>
          )}
          {facts.map((f, i) => (
            <span key={f} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden className="text-on-media-muted">·</span>}
              {f}
            </span>
          ))}
        </p>
      )}
      <div className={`mirror-detail-in-meta flex ${centered ? "justify-center" : ""}`}>
        <MetaTokens item={item} onMedia />
      </div>
    </div>
  );
});
