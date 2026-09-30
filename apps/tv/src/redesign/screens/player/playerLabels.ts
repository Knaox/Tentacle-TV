import type { SkipLabelKey } from "@tentacle-tv/shared";
import type { PlayerLabels } from "./playerTypes";

/**
 * Les mots de l'habillage, tirés des clés i18n (`player`, `common`) — le
 * seul endroit où la vue et ses clés se rencontrent. Purs : l'intégration
 * les appelle avec son `t`, le banc avec `i18n.t`.
 */

export type Translate = (key: string, options?: Record<string, unknown>) => string;

export function playerChromeLabels(t: Translate, seek: { back: number; forward: number }): PlayerLabels {
  return {
    back: t("player:back"),
    play: t("player:play"),
    pause: t("player:pause"),
    seekBack: t("player:seekBackBy", { seconds: seek.back }),
    seekForward: t("player:seekForwardBy", { seconds: seek.forward }),
    seekMode: t("player:seekMode"),
    previous: t("player:previousEpisodeLabel"),
    next: t("player:nextEpisodeLabel"),
    episodes: t("player:episodes"),
    tracks: t("player:tracks"),
    dismiss: t("player:dismiss"),
    playNow: t("player:playNow"),
    backToDetails: t("player:backToDetails"),
    upNext: t("player:upNext"),
    nowPlaying: t("player:nowPlaying"),
    retry: t("player:retry"),
    audio: t("player:audio"),
    subtitles: t("player:subtitles"),
    quality: t("player:quality"),
    auto: t("player:qualityAutoBadge"),
    close: t("player:close"),
    scrubConfirm: t("player:scrubConfirmHint"),
    scrubCancel: t("player:scrubCancelHint"),
  };
}

/** Le libellé de la pilule : la forme décomptée quand un décompte court
 *  (« Passer l'intro dans 5 s »). « Aller à l'épisode suivant » n'en a pas. */
export function skipPillLabel(t: Translate, labelKey: SkipLabelKey, countdownSeconds: number | null): string {
  if (labelKey === "goToNextEpisode" || countdownSeconds === null) return t(`player:${labelKey}`);
  return t(`player:${labelKey}In`, { seconds: countdownSeconds });
}

/** Le badge d'un saut OSD caché : « +30 s », « −10 s » (cumulés). */
export function seekFlashLabel(t: Translate, deltaSeconds: number): string {
  const seconds = Math.abs(Math.round(deltaSeconds));
  return t(deltaSeconds >= 0 ? "player:seekFlashForward" : "player:seekFlashBack", { seconds });
}

/** « Épisode suivant dans 8 s » — carte du générique et affiche de fin. */
export function nextCountdownLabel(t: Translate, seconds: number): string {
  return t("player:autoplayCountdown", { seconds });
}
