import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { useJellyfinClient, useWatchedToggle } from "@tentacle-tv/api-client";
import { resolveBannerImage, type MediaItem } from "@tentacle-tv/shared";
import { MetaTokens } from "./MetaTokens";
import { episodeCode } from "./detailMetrics";

export const THUMB_W = 110;
export const THUMB_H = 62;

interface Props {
  ep: MediaItem;
  seriesId: string;
  seasonId: string;
  onPlay: (ep: MediaItem) => void;
  isCurrent?: boolean;
}

/**
 * `EpisodeItemRow` de l'app : fond `fill.faint` rayon 10, vignette 110 × 62
 * (rayon 6) et sa piste de progression de 3, numéro et titre 13 (800 pour
 * l'épisode courant, précédé d'un point rose de 7), « Épisode actuel » et durée,
 * jetons compacts, résumé sur 2 lignes, puis le rond « vu » de 30.
 */
export const EpisodeRow = memo(function EpisodeRow({ ep, seriesId, seasonId, onPlay, isCurrent = false }: Props) {
  const { t } = useTranslation("common");
  const { markWatched, markUnwatched } = useWatchedToggle(ep.Id, { seriesId, seasonId });
  const played = ep.UserData?.Played === true;
  const progress = ep.UserData?.PlayedPercentage;
  const runtime = ep.RunTimeTicks ? Math.round(ep.RunTimeTicks / 600_000_000) : null;
  const epLabel = ep.IndexNumber != null ? `${episodeCode(ep.ParentIndexNumber, ep.IndexNumber)} · ` : "";

  return (
    <div className="flex min-h-[62px] items-center overflow-hidden rounded-[10px] bg-fill-faint">
      <button type="button" onClick={() => onPlay(ep)} className="flex min-w-0 flex-1 text-left" style={{ WebkitTapHighlightColor: "transparent" }}>
        <span className="relative shrink-0 self-center overflow-hidden rounded-md bg-surface-2" style={{ width: THUMB_W, height: THUMB_H }}>
          <EpisodeThumb ep={ep} seriesId={seriesId} />
          {progress != null && progress > 0 && (
            <span className="absolute inset-x-0 bottom-0 h-[3px] bg-fill-strong">
              <span
                className="block h-full"
                style={{ width: `${progress}%`, background: "linear-gradient(90deg, var(--brand), var(--brand-accent))" }}
              />
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col justify-center p-2.5">
          <span className="flex items-center gap-1.5">
            {isCurrent && <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[var(--brand-accent)]" />}
            <span className={`min-w-0 flex-1 truncate text-[13px] text-content-primary ${isCurrent ? "font-extrabold" : "font-semibold"}`}>
              {epLabel}
              {ep.Name}
            </span>
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            {isCurrent && (
              <span className="mirror-detail-accent-text text-[10px] font-bold uppercase tracking-[0.6px]">{t("currentEpisode")}</span>
            )}
            {runtime ? <span className="text-[11px] text-content-quaternary">{t("minutesShort", { count: runtime })}</span> : null}
          </span>
          <MetaTokens item={ep} compact />
          {ep.Overview && (
            <span className="mt-1 line-clamp-2 text-[11px] leading-[15px] text-content-quaternary">{ep.Overview}</span>
          )}
        </span>
      </button>

      <button
        type="button"
        onClick={() => (played ? markUnwatched.mutate() : markWatched.mutate())}
        aria-label={played ? t("markUnwatched") : t("markWatched")}
        className="shrink-0 py-3 pl-1 pr-3"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <span
          className={`mirror-detail-pop flex h-[30px] w-[30px] items-center justify-center rounded-full border ${
            played ? "mirror-detail-accent-text" : "border-line-subtle bg-fill-subtle text-content-disabled"
          }`}
          style={
            played
              ? { background: "rgba(var(--brand-accent-rgb), 0.15)", borderColor: "rgba(var(--brand-accent-rgb), 0.45)" }
              : undefined
          }
        >
          <Check size={16} aria-hidden />
        </span>
      </button>
    </div>
  );
});

/**
 * `EpisodeThumb` de l'app : l'image de l'épisode (chaîne 16:9 partagée), sinon
 * le visuel de la série, sinon son numéro en 18 gras tertiaire.
 */
function EpisodeThumb({ ep, seriesId }: { ep: MediaItem; seriesId: string }) {
  const client = useJellyfinClient();
  const [broken, setBroken] = useState(false);
  const resolved = resolveBannerImage(ep);
  const url = resolved
    ? client.getImageUrl(resolved.id, resolved.type, { width: 300, quality: 70, ...(resolved.tag ? { tag: resolved.tag } : {}) })
    : client.getImageUrl(seriesId, "Backdrop", { width: 300, quality: 70 });

  if (broken) {
    return (
      <span className="flex h-full w-full items-center justify-center bg-surface-2 text-[18px] font-bold text-content-tertiary">
        {ep.IndexNumber != null ? `E${ep.IndexNumber}` : ep.Name?.charAt(0).toUpperCase() ?? "?"}
      </span>
    );
  }
  return (
    <img src={url} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setBroken(true)} className="h-full w-full object-cover" />
  );
}
