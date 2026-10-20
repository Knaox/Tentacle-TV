import type { WtPlayerPort } from "@tentacle-tv/api-client";

/**
 * Watch Together — l'adaptateur du port lecteur pour le mobile et l'iPad,
 * commun aux deux moteurs (mpv, lecteur système). Module PUR : horloge
 * injectée, ni React ni React Native.
 *
 * Le moteur mobile ne se lit pas : il ANNONCE sa position (`onProgress`, 4 Hz
 * pour le lecteur système, au fil de mpv pour l'autre), sa pause et son
 * tampon. L'adaptateur tient ces annonces et rend au moteur de synchro une
 * position EXTRAPOLÉE à l'instant de la lecture — sauf en pause, en tampon ou
 * pendant un saut, où le flux ne court pas. Précision « coarse » : la boucle
 * de dérive élargit sa zone morte, comme pour mpv sur le bureau.
 */

/** Au-delà, une annonce trop vieille ne s'extrapole plus (moteur gelé, appli en fond). */
export const EXTRAPOLATE_MAX_MS = 1_500;
/** Après un ordre de saut, le temps de laisser le moteur annoncer l'ancienne position. */
export const SEEK_SETTLE_MS = 150;
/** Un saut sans atterrissage vu au-delà est tenu pour fini : la position seule fait foi. */
export const SEEK_GIVE_UP_MS = 15_000;
/** Atterri : la position annoncée dans cette fenêtre autour de la cible. */
export const SEEK_LAND_BEFORE_S = 0.5;
export const SEEK_LAND_AFTER_S = 3;
/** Posé sur la cible de la barrière : à moins de ça (cf. `isSettledAt`). */
export const SETTLED_TOLERANCE_S = 0.15;

/** Ce que l'adaptateur commande à l'écran du lecteur. */
export interface MobileTransportCommands {
  /** L'état de pause déclaratif de l'écran. */
  setPaused(paused: boolean): void;
  /** Le saut de l'écran, en position FILM (bornage et décalage de flux compris). */
  seek(filmSeconds: number): void;
  /** La vitesse de lecture (prop `rate` / `speed` du moteur). */
  setRate(rate: number): void;
  cancelAutoNext?(): void;
}

/** Ce que l'écran rapporte à l'adaptateur, au fil des évènements du moteur. */
export interface MobileTransportReports {
  progress(filmSeconds: number): void;
  paused(paused: boolean): void;
  buffering(buffering: boolean): void;
  /** Le média courant est chargé (première image) — faux à chaque nouveau flux. */
  ready(ready: boolean): void;
}

export interface MobileTransport extends WtPlayerPort {
  reports: MobileTransportReports;
  /** Un saut demandé et pas encore atterri. */
  seekTarget(): number | null;
}

export function createMobileTransport(
  commands: MobileTransportCommands,
  now: () => number = Date.now,
): MobileTransport {
  let position = 0;
  let positionAt = 0;
  let paused = false;
  let buffering = true;
  let ready = false;
  let rate = 1;
  let seek: { target: number; at: number } | null = null;

  /** Le saut est-il encore en vol ? (un saut trop vieux est oublié au passage) */
  const seekInFlight = (t: number): boolean => {
    if (!seek) return false;
    if (t - seek.at > SEEK_GIVE_UP_MS) { seek = null; return false; }
    return true;
  };

  const estimate = (t: number): number => {
    if (seekInFlight(t)) return seek!.target;
    if (positionAt === 0 || paused || buffering || !ready) return position;
    const elapsed = Math.min(Math.max(0, t - positionAt), EXTRAPOLATE_MAX_MS);
    return position + (elapsed / 1000) * rate;
  };

  const reports: MobileTransportReports = {
    progress(filmSeconds) {
      const t = now();
      if (seek && t - seek.at >= SEEK_SETTLE_MS) {
        const landed = filmSeconds >= seek.target - SEEK_LAND_BEFORE_S
          && filmSeconds <= seek.target + SEEK_LAND_AFTER_S;
        if (landed) seek = null;
      }
      position = filmSeconds;
      positionAt = t;
    },
    paused(value) {
      // Le flux s'arrête ou repart : la position extrapolée devient la référence.
      position = estimate(now());
      positionAt = now();
      paused = value;
    },
    buffering(value) {
      position = estimate(now());
      positionAt = now();
      buffering = value;
    },
    ready(value) {
      ready = value;
      if (!value) { positionAt = 0; buffering = true; }
    },
  };

  return {
    precision: "coarse",
    reports,
    seekTarget: () => (seekInFlight(now()) ? seek!.target : null),
    play() {
      // Le temps passé en pause ne s'extrapole pas : la référence repart d'ici.
      position = estimate(now());
      positionAt = now();
      paused = false;
      commands.setPaused(false);
    },
    pause() {
      position = estimate(now());
      positionAt = now();
      paused = true;
      commands.setPaused(true);
    },
    seekTo(seconds) {
      const target = Math.max(0, seconds);
      seek = { target, at: now() };
      position = target;
      positionAt = now();
      commands.seek(target);
    },
    getPositionSeconds: () => estimate(now()),
    isPaused: () => paused,
    setRate(value) {
      position = estimate(now());
      positionAt = now();
      rate = value;
      commands.setRate(value);
    },
    cancelAutoNext: commands.cancelAutoNext ? () => commands.cancelAutoNext?.() : undefined,
    isMediaReady: () => ready && !buffering,
    isSeeking: () => seekInFlight(now()),
    isSettledAt(targetSeconds) {
      const t = now();
      if (!ready || buffering || seekInFlight(t)) return false;
      return Math.abs(estimate(t) - targetSeconds) <= SETTLED_TOLERANCE_S;
    },
  };
}
