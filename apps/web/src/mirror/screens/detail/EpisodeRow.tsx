import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MoreHorizontal } from "lucide-react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { resolveBannerImage, resolveCardMarkers, type MediaItem } from "@tentacle-tv/shared";
import { CardStatusMarkers } from "../../../components/cards/CardStatusMarkers";
import { cardProgress } from "../../cards/cardProgress";
import { useOpenCardSheet } from "../../cards/cardSheet";
import { ProgressBar } from "../../ui/ProgressBar";
import { useLongPress } from "../../ui/useLongPress";
import { MetaTokens } from "./MetaTokens";
import { episodeCode } from "./detailMetrics";

export const THUMB_W = 110;
export const THUMB_H = 62;

interface Props {
  ep: MediaItem;
  seriesId: string;
  /** La saison du conteneur — la bascule « vu », qui s'en servait, est passée à la feuille. */
  seasonId: string;
  onPlay: (ep: MediaItem) => void;
  isCurrent?: boolean;
}

/**
 * `EpisodeItemRow` de l'app : fond `fill.faint` rayon 10, vignette 110 × 62
 * (rayon 6), numéro et titre 13 (800 pour l'épisode courant, précédé d'un
 * point rose de 7), « Épisode actuel » et durée, jetons compacts, résumé sur
 * 2 lignes, puis « ⋯ ».
 *
 * La grammaire des cartes : l'ÉTAT se lit sur la vignette et nulle part
 * ailleurs — la pastille du modèle (« vu ») ou la barre commune ; les ACTIONS
 * vivent dans la feuille de l'épisode (vignette 16:9 : son toucher le lance,
 * la fiche passe par la feuille), ouverte par l'appui long ou par le « ⋯ ».
 * Une bascule « vu » toujours visible, pleine quand l'épisode l'était,
 * doublait la pastille.
 */
export const EpisodeRow = memo(function EpisodeRow({ ep, seriesId, onPlay, isCurrent = false }: Props) {
  const { t } = useTranslation(["common", "cards"]);
  const openSheet = useOpenCardSheet();
  const openActions = openSheet ? () => openSheet({ kind: "media", variant: "landscape", item: ep }) : undefined;
  const press = useLongPress(openActions);
  const markers = resolveCardMarkers({ item: ep, communityRating: null, inWatchlist: false, isFavorite: false });
  const played = markers.statuses.includes("watched");
  const progress = cardProgress(ep.UserData);
  const runtime = ep.RunTimeTicks ? Math.round(ep.RunTimeTicks / 600_000_000) : null;
  const epLabel = ep.IndexNumber != null ? `${episodeCode(ep.ParentIndexNumber, ep.IndexNumber)} · ` : "";

  return (
    <div className="flex min-h-[62px] items-center overflow-hidden rounded-[10px] bg-fill-faint">
      <button
        type="button"
        {...press.handlers}
        onClick={() => {
          if (!press.consumeClick()) onPlay(ep);
        }}
        className="flex min-w-0 flex-1 select-none text-left"
        style={{ WebkitTapHighlightColor: "transparent", WebkitTouchCallout: "none" }}
      >
        <span className="relative shrink-0 self-center overflow-hidden rounded-md bg-surface-2" style={{ width: THUMB_W, height: THUMB_H }}>
          <EpisodeThumb ep={ep} seriesId={seriesId} />
          {!played && progress !== null && <ProgressBar progress={progress} className="absolute inset-x-0 bottom-0" />}
          <CardStatusMarkers statuses={markers.statuses} className="right-1 top-1" />
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
              <span className="mirror-detail-accent-text text-[10px] font-bold uppercase tracking-[0.6px]">{t("common:currentEpisode")}</span>
            )}
            {runtime ? <span className="text-[11px] text-content-tertiary">{t("common:minutesShort", { count: runtime })}</span> : null}
          </span>
          <MetaTokens item={ep} compact />
          {ep.Overview && (
            <span className="mt-1 line-clamp-2 text-[11px] leading-[15px] text-content-tertiary">{ep.Overview}</span>
          )}
        </span>
      </button>

      {openActions ? (
        <button
          type="button"
          onClick={openActions}
          aria-label={`${t("cards:moreActions")} — ${ep.Name ?? ""}`}
          className="shrink-0 px-2.5 py-3 text-content-secondary"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <MoreHorizontal size={20} aria-hidden />
        </button>
      ) : (
        <span aria-hidden className="w-2.5 shrink-0" />
      )}
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
