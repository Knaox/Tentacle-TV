import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { useJellyfinClient, useWatchedToggle } from "@tentacle-tv/api-client";
import { resolveBannerImage, type MediaItem } from "@tentacle-tv/shared";
import { stripOverviewHtml } from "../../../lib/overviewHtml";
import { episodeCode } from "../playerMetrics";
import { SHEET } from "./sheetColors";

const THUMB_W = 110;
const THUMB_H = 62;

interface Props {
  ep: MediaItem;
  seriesId: string;
  seasonId: string;
  isCurrent: boolean;
  onPlay: (ep: MediaItem) => void;
}

/**
 * Une ligne d'épisode — `EpisodeItemRow` de l'app : fond `fill.faint` rayon
 * 10, vignette 110 × 62 (rayon 6) avec sa piste de progression de 3, titre
 * 13 px (« S01E02 · »), point et mention « épisode actuel », durée 11 px,
 * synopsis 2 lignes, et le rond « vu » de 30 qui bascule l'état.
 */
export const EpisodeRow = memo(function EpisodeRow({ ep, seriesId, seasonId, isCurrent, onPlay }: Props) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const { markWatched, markUnwatched } = useWatchedToggle(ep.Id, { seriesId, seasonId });
  const [thumbFailed, setThumbFailed] = useState(false);
  const played = ep.UserData?.Played === true;
  const progress = ep.UserData?.PlayedPercentage;
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
            {runtime && <span style={{ color: SHEET.textQuaternary, fontSize: 11 }}>{t("minutesShort", { count: runtime })}</span>}
          </div>
          {overview && (
            <p className="line-clamp-2" style={{ color: SHEET.textQuaternary, fontSize: 11, marginTop: 4, lineHeight: "15px" }}>{overview}</p>
          )}
        </div>
      </button>
      <button
        type="button"
        aria-label={played ? t("markUnwatched") : t("markWatched")}
        onClick={() => (played ? markUnwatched.mutate() : markWatched.mutate())}
        className="relative shrink-0 active:scale-75 transition-transform motion-reduce:transition-none [-webkit-tap-highlight-color:transparent]"
        style={{ paddingRight: 12, paddingLeft: 4 }}
      >
        <span
          className="flex items-center justify-center"
          style={{
            width: 30, height: 30, borderRadius: 15,
            backgroundColor: played ? SHEET.accentSoft : SHEET.fillSubtle,
            border: `1px solid ${played ? SHEET.accentGlow : SHEET.borderSubtle}`,
          }}
        >
          <Check size={16} color={played ? SHEET.accentText : SHEET.textDisabled} />
        </span>
      </button>
    </div>
  );
});
