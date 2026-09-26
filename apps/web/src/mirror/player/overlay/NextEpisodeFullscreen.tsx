import { useTranslation } from "react-i18next";
import { Play, X } from "lucide-react";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient, type EndCardRating } from "@tentacle-tv/api-client";
import { stripOverviewHtml } from "../../../lib/overviewHtml";
import { useViewport } from "../../useFormFactor";
import { useIsTablet } from "../../useMirrorLayout";
import { PLAYER } from "../playerColors";
import { episodeCode } from "../playerMetrics";
import { EndCardRatingBlock } from "./EndCardRatingBlock";
import { OverlayPill } from "./OverlayPill";
import { useArmedCountdown } from "./useArmedCountdown";
import { useEntered } from "./useEntered";

interface Props {
  nextEpisode: MediaItem;
  /** Secondes restantes ; `null` = affiche sans minuterie. */
  countdownSeconds: number | null;
  countdownTotalMs: number;
  onPlay: () => void;
  /** Refuser l'affiche — l'arbitre sort du lecteur (retour à la fiche). */
  onDismiss: () => void;
  rating?: EndCardRating | null;
  onRatingEngage?: () => void;
}

const SHADOW = "0 0 4px rgba(0,0,0,0.85)";

/**
 * L'affiche de fin PLEIN ÉCRAN — `NextEpisodeFullscreenMobile` de l'app : la
 * bannière de la série qui dézoome de 1,06 à 1 en 8 s sous deux voiles, la
 * croix ronde de 44 en haut à droite, et le panneau bas-gauche (vignette 16:9
 * rayon 12, « À suivre », « S01E02 », titre 23 / 32, synopsis 3 lignes, la
 * pilule qui REPREND le balayage de la carte, « Retour à la fiche », la
 * notation). Côte à côte dès 640 de large, en colonne sinon.
 */
export function NextEpisodeFullscreen({
  nextEpisode, countdownSeconds, countdownTotalMs, onPlay, onDismiss, rating, onRatingEngage,
}: Props) {
  const { t } = useTranslation("player");
  const client = useJellyfinClient();
  const { width } = useViewport();
  const isTablet = useIsTablet();
  const entered = useEntered();
  const armed = useArmedCountdown(countdownSeconds, countdownTotalMs);

  const isEpisode = nextEpisode.Type === "Episode";
  const seriesId = isEpisode ? (nextEpisode.ParentBackdropItemId ?? nextEpisode.SeriesId ?? nextEpisode.Id) : nextEpisode.Id;
  const backdropUrl = client.getImageUrl(seriesId, "Backdrop", { width: 1280, quality: 80 });
  const thumbUrl = client.getImageUrl(nextEpisode.Id, "Primary", { width: 500, quality: 85 });
  const overview = nextEpisode.Overview ? stripOverviewHtml(nextEpisode.Overview) : "";
  const label = isEpisode ? episodeCode(nextEpisode.ParentIndexNumber, nextEpisode.IndexNumber) : null;

  const row = width >= 640;
  const sidePad = "max(env(safe-area-inset-left, 0px), 24px)";
  const thumbW = row ? (isTablet ? 300 : 224) : `min(calc(${width}px - 2 * ${sidePad}), 320px)`;
  const titleSize = isTablet ? 32 : 23;
  const motion = "transition-[opacity,transform] ease-out motion-reduce:transition-none";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={`pointer-events-auto absolute inset-0 overflow-hidden duration-300 ${motion}`}
      style={{ zIndex: 60, backgroundColor: PLAYER.bg, opacity: entered ? 1 : 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #2b2436 0%, #16131c 55%, #0a0a0d 100%)" }} />
      <img
        src={backdropUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-transform ease-out motion-reduce:transition-none"
        style={{ transform: `scale(${entered ? 1 : 1.06})`, transitionDuration: "8000ms" }}
      />
      <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.52) 45%, rgba(0,0,0,0.26) 100%)" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.20) 55%, rgba(0,0,0,0.85) 100%)" }} />

      <button
        type="button"
        aria-label={t("backToDetails")}
        onClick={onDismiss}
        className="absolute z-[2] flex items-center justify-center active:opacity-75 [-webkit-tap-highlight-color:transparent]"
        style={{
          top: "calc(max(env(safe-area-inset-top, 0px), 16px) + 4px)",
          right: "calc(max(env(safe-area-inset-right, 0px), 16px) + 4px)",
          width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0, 0, 0, 0.65)",
        }}
      >
        <X size={22} color={PLAYER.text} />
      </button>

      <div
        className={`absolute inset-x-0 bottom-0 z-[1] flex duration-[350ms] ${motion}`}
        style={{
          paddingLeft: sidePad,
          paddingRight: "max(env(safe-area-inset-right, 0px), 24px)",
          paddingBottom: `max(env(safe-area-inset-bottom, 0px), ${isTablet ? 40 : 24}px)`,
          flexDirection: row ? "row" : "column",
          alignItems: row ? "flex-end" : "stretch",
          gap: row ? 24 : 14,
          opacity: entered ? 1 : 0,
          transform: `translateY(${entered ? 0 : 16}px)`,
          transitionDelay: "80ms",
        }}
      >
        <div className="relative shrink-0 overflow-hidden" style={{ width: thumbW, aspectRatio: "16 / 9", borderRadius: 12, backgroundColor: "#16131c" }}>
          <img src={thumbUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        </div>

        <div className="min-w-0" style={{ flex: row ? 1 : undefined }}>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 700, letterSpacing: 2.4, textTransform: "uppercase", textShadow: SHADOW }}>
            {t("upNext")}
          </p>
          {label && <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 700, letterSpacing: 2, marginTop: 6 }}>{label}</p>}
          <h2
            className="line-clamp-2"
            style={{ color: PLAYER.text, fontWeight: 800, letterSpacing: -0.4, marginTop: 4, fontSize: titleSize, lineHeight: `${titleSize + 5}px`, textShadow: "0 0 14px rgba(0,0,0,0.7)" }}
          >
            {nextEpisode.Name}
          </h2>
          {overview && (
            <p className="line-clamp-3" style={{ color: "rgba(255,255,255,0.7)", fontSize: isTablet ? 15 : 13, lineHeight: `${isTablet ? 22 : 19}px`, marginTop: 8 }}>
              {overview}
            </p>
          )}
          <div className="flex flex-row flex-wrap items-center" style={{ gap: 12, marginTop: 16 }}>
            <OverlayPill
              key={armed?.key ?? "manual"}
              label={countdownSeconds !== null ? t("playNowIn", { seconds: countdownSeconds }) : t("playNow")}
              onPress={onPlay}
              countdownMs={armed?.remainingMs ?? null}
              initialProgress={armed?.initialProgress ?? 0}
              icon={<Play size={15} color={PLAYER.textInverse} fill={PLAYER.textInverse} />}
            />
            <button
              type="button"
              onClick={onDismiss}
              className="flex items-center justify-center rounded-full active:opacity-70 [-webkit-tap-highlight-color:transparent]"
              style={{ minHeight: 44, border: "1px solid rgba(255, 255, 255, 0.25)", paddingInline: 20 }}
            >
              <span style={{ color: "rgba(255, 255, 255, 0.85)", fontSize: 14, fontWeight: 600 }}>{t("backToDetails")}</span>
            </button>
          </div>
          {rating && <EndCardRatingBlock rating={rating} onRatingEngage={onRatingEngage} />}
        </div>
      </div>
    </div>
  );
}
