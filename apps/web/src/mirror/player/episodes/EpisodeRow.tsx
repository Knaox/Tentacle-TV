import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { resolveBannerImage, resolveCardMarkers, type MediaItem } from "@tentacle-tv/shared";
import { CardStatusMarkers } from "../../../components/cards/CardStatusMarkers";
import { stripOverviewHtml } from "../../../lib/overviewHtml";
import { episodeCode } from "../playerMetrics";
import { SHEET } from "./sheetColors";

const THUMB_W = 110;
const THUMB_H = 62;

interface Props {
  ep: MediaItem;
  seriesId: string;
  /** La saison du conteneur — la bascule « vu », qui s'en servait, a quitté la ligne. */
  seasonId: string;
  isCurrent: boolean;
  onPlay: (ep: MediaItem) => void;
}

/**
 * Une ligne d'épisode — `EpisodeItemRow` de l'app, dans le lecteur : fond
 * `fill.faint` rayon 10, vignette 110 × 62 (rayon 6) avec sa piste de
 * progression de 3 et la pastille du modèle des cartes (« vu »), titre 13 px
 * (« S01E02 · »), point et mention « épisode actuel », durée 11 px, synopsis
 * 2 lignes. Un rond coché de 30 tenait lieu de marqueur « vu » en bout de
 * ligne : l'ancien dessin, hors du modèle. Comme sur l'app, la ligne du
 * lecteur ne porte que son état.
 */
export const EpisodeRow = memo(function EpisodeRow({ ep, seriesId, isCurrent, onPlay }: Props) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const [thumbFailed, setThumbFailed] = useState(false);
  const markers = resolveCardMarkers({ item: ep, communityRating: null, inWatchlist: false, isFavorite: false });
  const played = markers.statuses.includes("watched");
  const progress = played ? null : ep.UserData?.PlayedPercentage;
  const runtime = ep.RunTimeTicks ? Math.round(ep.RunTimeTicks / 600_000_000) : null;
  const code = ep.IndexNumber != null ? `${episodeCode(ep.ParentIndexNumber ?? 1, ep.IndexNumber)} · ` : "";
  const resolved = resolveBannerImage(ep);
  const thumbUrl = resolved
    ? client.getImageUrl(resolved.id, resolved.type, { width: 300, quality: 70, ...(resolved.tag ? { tag: resolved.tag } : {}) })
    : client.getImageUrl(seriesId, "Backdrop", { width: 300, quality: 70 });
  const overview = ep.Overview ? stripOverviewHtml(ep.Overview) : "";

  return (
    <div className="flex flex-row items-center overflow-hidden" style={{ backgroundColor: SHEET.fillFaint, borderRadius: 10, minHeight: THUMB_H }}>
      <button type="button" onClick={() => onPlay(ep)} className="flex min-w-0 flex-1 flex-row text-left [-webkit-tap-highlight-color:transparent]">
        <div className="relative shrink-0 self-center overflow-hidden" style={{ width: THUMB_W, height: THUMB_H, borderRadius: 6, backgroundColor: SHEET.surface2 }}>
          {thumbFailed ? (
            <div className="flex h-full w-full items-center justify-center" style={{ fontSize: 18, fontWeight: 700, color: SHEET.textTertiary }}>
              {ep.IndexNumber != null ? `E${ep.IndexNumber}` : ep.Name?.charAt(0).toUpperCase() ?? "?"}
            </div>
          ) : (
            <img src={thumbUrl} alt="" loading="lazy" onError={() => setThumbFailed(true)} className="h-full w-full object-cover" />
          )}
          {progress != null && progress > 0 && (
            <div className="absolute inset-x-0 bottom-0" style={{ height: 3, backgroundColor: SHEET.fillStrong }}>
              <div className="h-full" style={{ width: `${progress}%`, background: "linear-gradient(90deg, var(--brand), var(--brand-accent))" }} />
            </div>
          )}
          <CardStatusMarkers statuses={markers.statuses} className="right-1 top-1" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center" style={{ padding: 10 }}>
          <div className="flex flex-row items-center" style={{ gap: 6 }}>
            {isCurrent && <span className="shrink-0" style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "var(--brand-accent)" }} />}
            <span className="truncate" style={{ color: SHEET.textPrimary, fontSize: 13, fontWeight: isCurrent ? 800 : 600 }}>
              {code}{ep.Name}
            </span>
          </div>
          <div className="flex flex-row items-center" style={{ gap: 8, marginTop: 2 }}>
            {isCurrent && (
              <span style={{ color: SHEET.accentText, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>
                {t("currentEpisode")}
              </span>
            )}
            {runtime && <span style={{ color: SHEET.textTertiary, fontSize: 11 }}>{t("minutesShort", { count: runtime })}</span>}
          </div>
          {overview && (
            <p className="line-clamp-2" style={{ color: SHEET.textTertiary, fontSize: 11, marginTop: 4, lineHeight: "15px" }}>{overview}</p>
          )}
        </div>
      </button>
    </div>
  );
});
