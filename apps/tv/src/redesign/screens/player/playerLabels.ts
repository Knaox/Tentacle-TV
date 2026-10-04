import type { SkipLabelKey } from "@tentacle-tv/shared";
import { formatClock } from "./formatClock";
import type { PlayerLabels, ScrubCountdownModel } from "./playerTypes";

/**
 * Les mots de l'habillage, tirés des clés i18n (`player`, `common`) — le
 * seul endroit où la vue et ses clés se rencontrent. Purs : l'intégration
 * les appelle avec son `t`, le banc avec `i18n.t`.
 */

export type Translate = (key: string, options?: Record<string, unknown>) => string;

export function playerChromeLabels(t: Translate, seek: { back: number; forward: number }): PlayerLabels {
  // Ni « Retour » ni « Fermer » : la croix (`BackButton`) dit « Retour » elle-même.
  return {
    play: t("player:play"),
    pause: t("player:pause"),
    seekBack: t("player:seekBackBy", { seconds: seek.back }),
    seekForward: t("player:seekForwardBy", { seconds: seek.forward }),
    seekMode: t("player:seekMode"),
    previous: t("player:previousEpisodeLabel"),
    next: t("player:nextEpisodeLabel"),
    episodes: t("player:episodes"),
    tracks: t("player:tracks"),
    settings: t("player:playbackSettings"),
    dismiss: t("player:dismiss"),
    playNow: t("player:playNow"),
    upNext: t("player:upNext"),
    nowPlaying: t("player:nowPlaying"),
    retry: t("player:retry"),
    audio: t("player:audio"),
    subtitles: t("player:subtitles"),
    quality: t("player:quality"),
    auto: t("player:qualityAutoBadge"),
    qualityGuideTitle: t("player:qualityGuideTitle"),
    qualityGuideOriginal: t("player:qualityGuideOriginal"),
    qualityGuideConverted: t("player:qualityGuideConverted"),
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

/** Le décompte du défilement : ce qui se passera à son terme — revenir à
 *  `origin` (« Retour à 12:34 dans 5 s ») ou lire à la position visée
 *  (« Lecture dans 5 s ») — et le geste de l'autre choix. */
export function scrubCountdownLabels(
  t: Translate, outcome: ScrubCountdownModel["outcome"], seconds: number, origin: number,
): { label: string; hint: string } {
  const time = formatClock(origin);
  return outcome === "return"
    ? { label: t("player:scrubReturnToIn", { time, seconds }), hint: t("player:scrubOtherPlayHere") }
    : { label: t("player:scrubPlayIn", { seconds }), hint: t("player:scrubOtherGoBack", { time }) };
}

/** « Épisode suivant dans 8 s » — carte du générique et affiche de fin. */
export function nextCountdownLabel(t: Translate, seconds: number): string {
  return t("player:autoplayCountdown", { seconds });
}
