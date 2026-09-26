import { memo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, ChevronRight, Play, Star } from "lucide-react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useThemeMode } from "../../../theme/useThemeMode";
import { ProgressBar } from "../../ui/ProgressBar";
import { DetailActionsRow, type DetailActions } from "./DetailActionsRow";
import { MetaTokens } from "./MetaTokens";
import { episodeCode, playCta, PLAY_MAX_WIDTH, RATING_COLOR, runtimeMinutes } from "./detailMetrics";

type SeriesWatchState = { type: string; episode?: MediaItem } | undefined;

interface Props {
  item: MediaItem;
  twoCol: boolean;
  seriesWatchState: SeriesWatchState;
  posterW: number;
  posterH: number;
  actions: DetailActions;
}

/**
 * `DetailHeader` de l'app : affiche + titre/méta + bouton Lecture + actions.
 * Portrait : affiche et méta en rangée, l'affiche remontant de 55 % de sa
 * hauteur sur le visuel. iPad paysage (`twoCol`) : tout empilé dans la
 * colonne gauche figée, marges 16.
 */
export const DetailHeader = memo(function DetailHeader({ item, twoCol, seriesWatchState, posterW, posterH, actions }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const { isDark } = useThemeMode();
  const [posterBroken, setPosterBroken] = useState(false);

  const isSeries = item.Type === "Series";
  const isEpisode = item.Type === "Episode";
  const posterId = isEpisode ? (item.SeriesId ?? item.Id) : item.Id;
  const poster = client.getImageUrl(posterId, "Primary", { height: 500, quality: 90 });
  const isWatched = item.UserData?.Played === true;
  const rating = item.CommunityRating?.toFixed(1);
  const runtimeMin = runtimeMinutes(item.RunTimeTicks);
  const cta = playCta(item, seriesWatchState, t);

  const posterEl = (
    <div className="mirror-detail-in-poster relative shrink-0" style={{ width: posterW, height: posterH }}>
      <div
        className="h-full w-full overflow-hidden rounded-xl bg-surface-2"
        style={{ boxShadow: "0 12px 20px rgba(0,0,0,0.55)" }}
      >
        {!posterBroken && (
          <img src={poster} alt="" decoding="async" draggable={false} onError={() => setPosterBroken(true)} className="h-full w-full object-cover" />
        )}
      </div>
      {isWatched && (
        <span
          className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-cta-primary-bg text-cta-primary-fg"
          style={{ boxShadow: "0 2px 4px rgba(0,0,0,0.35)" }}
        >
          <Check size={14} strokeWidth={2.5} aria-hidden />
        </span>
      )}
    </div>
  );

  const metaEl = (
    <div className="mirror-detail-in-title min-w-0">
      {isEpisode && item.SeriesName && (
        item.SeriesId ? (
          <button
            type="button"
            onClick={() => navigate(`/media/${item.SeriesId}`)}
            aria-label={item.SeriesName}
            className="mirror-detail-fade-press mb-1 flex max-w-full items-center gap-1 text-brand-light"
          >
            <span className="truncate text-[13px] font-semibold tracking-[0.2px]">{item.SeriesName}</span>
            <ChevronRight size={14} className="shrink-0" aria-hidden />
          </button>
        ) : (
          <p className="mb-1 truncate text-[13px] font-semibold tracking-[0.2px] text-brand-light">{item.SeriesName}</p>
        )
      )}
      <h1
        className="line-clamp-3 break-words text-[26px] font-extrabold leading-[30px] tracking-[-0.6px] text-on-media-primary"
        style={{ textShadow: "0 1px 6px var(--on-media-shadow)" }}
      >
        {isEpisode && item.IndexNumber != null ? `${episodeCode(item.ParentIndexNumber, item.IndexNumber)} · ` : ""}
        {item.Name}
      </h1>
      <div className="mirror-detail-in-meta">
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px] tracking-[-0.075px]">
          {item.ProductionYear != null && <span className="font-medium text-content-secondary">{item.ProductionYear}</span>}
          {runtimeMin != null && runtimeMin > 0 && (
            <>
              <span className="text-content-quaternary">·</span>
              <span className="font-medium text-content-secondary">{t("minutesShort", { count: runtimeMin })}</span>
            </>
          )}
          {rating && (
            <>
              <span className="text-content-quaternary">·</span>
              <span className="flex items-center gap-[3px] font-semibold" style={{ color: RATING_COLOR }}>
                <Star size={11} aria-hidden />
                {rating}
              </span>
            </>
          )}
          {isSeries && item.ChildCount != null && item.ChildCount > 0 && (
            <span className="font-medium text-content-secondary">· {t("seasonsCount", { count: item.ChildCount })}</span>
          )}
        </div>
        <MetaTokens item={item} />
      </div>
    </div>
  );

  const playEl = cta.targetId ? (
    <div className="mirror-detail-in-actions mt-5">
      <div className="w-full" style={{ maxWidth: PLAY_MAX_WIDTH }}>
        <button
          type="button"
          onClick={() => navigate(`/watch/${cta.targetId}`)}
          aria-label={`${cta.label} ${item.Name}`}
          className="mirror-detail-fade-press flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full border border-cta-primary-border bg-cta-primary-bg px-7 text-cta-primary-fg"
          style={{ ["--press-opacity" as string]: 0.85, boxShadow: isDark ? "0 6px 12px rgba(0,0,0,0.35)" : "var(--elev-2)" }}
        >
          <Play size={20} fill="currentColor" aria-hidden className="shrink-0" />
          <span className="truncate text-[16px] font-bold tracking-[0.2px]">{cta.label}</span>
        </button>
        {cta.showProgress && <ProgressBar progress={cta.progress} className="mt-2.5" />}
      </div>
    </div>
  ) : null;

  const actionsEl = (
    <div className="mirror-detail-in-actions">
      <DetailActionsRow {...actions} />
    </div>
  );

  if (twoCol) {
    return (
      <div className="px-4">
        {posterEl}
        <div className="mt-3">{metaEl}</div>
        {playEl}
        {actionsEl}
      </div>
    );
  }

  return (
    <>
      <div className="relative flex px-4" style={{ marginTop: -(posterH * 0.55) }}>
        {posterEl}
        <div className="ml-4 flex min-w-0 flex-1 flex-col justify-end">{metaEl}</div>
      </div>
      <div className="px-4">{playEl}</div>
      {actionsEl}
    </>
  );
});
