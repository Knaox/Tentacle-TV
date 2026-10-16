import type { RemoteIntent } from "../remote/intents";
import type { RemoteHintId } from "../remote/bindings/hints";

/**
 * La télécommande PENDANT l'aperçu d'une carte (Apple TV, Android TV) — pur.
 *
 * - Lecture/Pause met VRAIMENT l'aperçu en pause, et le reprend ; les touches
 *   Lecture et Pause séparées (MEDIA_PLAY, MEDIA_PAUSE d'Android) font ce
 *   qu'elles disent.
 * - Lecture/Pause MAINTENUE coupe le son de l'APERÇU, ou le remet — jamais
 *   celui du téléviseur : la Siri Remote n'a pas de touche muet (son volume
 *   part au téléviseur, par HDMI-CEC ou infrarouge), et sur Android TV la
 *   sourdine et le volume n'atteignent jamais l'app (le système les garde ;
 *   les prendre volerait la sourdine du téléviseur). L'état muet est celui du
 *   réglage « Son des aperçus » de l'appareil : retenu, et visible dans les
 *   Réglages.
 * - Rien d'autre n'est pris : OK, la croix, Retour, OK maintenu (le grand
 *   panneau) gardent leur rôle.
 *
 * Le maintien arrive tel quel des deux tables (`hold` de `playPause` : tvOS
 * l'annonce, Android le reconstruit — `createAndroidTvReader`) ; seule sa
 * PREMIÈRE phase compte, le reste du maintien ne refait rien.
 */

export type PreviewRemoteAction = "togglePause" | "play" | "pause" | "toggleMute" | "holding";

/** L'action d'une intention pendant l'aperçu ; `null` : elle n'est pas pour lui. */
export function previewRemoteAction(intent: RemoteIntent): PreviewRemoteAction | null {
  switch (intent.type) {
    case "playPause":
      return "togglePause";
    case "transport":
      return intent.command === "lecture" ? "play" : intent.command === "pause" ? "pause" : null;
    case "hold":
      if (intent.key !== "playPause") return null;
      // La suite du maintien est prise aussi : elle ne doit rien faire ailleurs.
      return intent.phase === "start" ? "toggleMute" : "holding";
    default:
      return null;
  }
}

/** L'aperçu en pause après l'action (`toggleMute` et la suite d'un maintien n'y touchent pas). */
export function previewPausedAfter(paused: boolean, action: PreviewRemoteAction): boolean {
  if (action === "togglePause") return !paused;
  if (action === "play") return false;
  if (action === "pause") return true;
  return paused;
}

/** Les deux moitiés de l'indice sous la carte, selon l'état : « Lecture/Pause : pause · maintenir : couper le son ». */
export function previewRemoteHintIds(state: { paused: boolean; muted: boolean }): readonly [RemoteHintId, RemoteHintId] {
  return [state.paused ? "previewResume" : "previewPause", state.muted ? "previewUnmute" : "previewMute"];
}
