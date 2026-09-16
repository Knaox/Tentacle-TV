import type { MutableRefObject } from "react";

/**
 * L'horloge de mpv, telle que la page la reçoit : deux propriétés étranglées
 * à 8 Hz par la coquille (`mpvDrain.ts`), chacune horodatée à sa lecture dans
 * la file de mpv.
 *
 * `time-pos` est la position de l'IMAGE affichée : elle avance par sauts d'une
 * image (42 ms à 24 i/s), et la boucle d'affichage la pose à la mise en file
 * d'une image, jusqu'à une image avant qu'elle ne soit visible. `audio-pts`
 * est l'horloge AUDIO — l'échantillon qui sort du haut-parleur à l'instant de
 * la lecture, latence de la sortie déduite — continue et sans quantification.
 * C'est cette horloge-là que `currentTime` d'un navigateur rapporte ; comparer
 * les deux lecteurs sur la même horloge retire un biais d'une image, soit
 * jusqu'à 40 ms sur un film, dans un sens qui dépend de la sortie vidéo.
 *
 * L'horloge audio ne vaut qu'en lecture : en pause, après un seek ou pendant un
 * remplissage de cache, elle est figée ou périmée, et `time-pos` fait foi.
 */
export interface MpvClockRefs {
  /** Dernier `time-pos` brut (secondes de flux) et son instant de mesure. */
  positionRef: MutableRefObject<number>;
  positionAtRef: MutableRefObject<number>;
  /** Dernier `audio-pts` (secondes de flux) et son instant ; 0 tant qu'absent. */
  audioPtsRef: MutableRefObject<number>;
  audioPtsAtRef: MutableRefObject<number>;
  /** `playback-restart` reçus — un seek abouti en émet un — et l'instant du
   *  dernier (`Date.now()` à sa réception par la page) : un `time-pos` mesuré
   *  avant lui parle encore du seek en vol (mpv y annonce la CIBLE comme
   *  position), pas de l'atterrissage. */
  restartCountRef: MutableRefObject<number>;
  restartAtRef: MutableRefObject<number>;
}

export interface ClockSample {
  /** Position de flux (secondes). */
  positionS: number;
  /** `Date.now()` de la mesure ; 0 = jamais mesuré. */
  at: number;
}

/** Au-delà, l'horloge audio est périmée (mpv n'en émet plus quand rien ne joue). */
export const AUDIO_CLOCK_MAX_AGE_MS = 400;
/** Au-delà, les deux horloges ne parlent pas du même instant (seek en vol,
 *  audio pas encore reparti) : l'image fait foi. */
export const AUDIO_CLOCK_MAX_GAP_S = 1;

/**
 * L'échantillon de position à retenir à l'instant `now` : l'horloge audio
 * quand elle est fraîche et cohérente avec l'image, sinon `time-pos`.
 */
export function pickClockSample(
  video: ClockSample,
  audio: ClockSample | null,
  now: number,
): ClockSample & { source: "audio" | "video" } {
  if (
    audio === null || audio.at === 0 || !Number.isFinite(audio.positionS)
    || now - audio.at > AUDIO_CLOCK_MAX_AGE_MS
    || Math.abs(audio.positionS - video.positionS) > AUDIO_CLOCK_MAX_GAP_S
  ) {
    return { ...video, source: "video" };
  }
  return { ...audio, source: "audio" };
}
