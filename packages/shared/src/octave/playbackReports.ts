/**
 * Octave — le rapport d'écoute : à Jellyfin pour un titre de la bibliothèque
 * (`/api/music/playback` : start, progress, pause, stop), à l'extension pour
 * un titre hors bibliothèque (`music.played`, au bout seulement).
 *
 * La progression a deux cadences : 15 s au premier plan, 60 s quand l'app est
 * DERRIÈRE (écran éteint, autre app — `ReportSinks.background`, injecté par le
 * mobile seul) : chaque rapport réveille le modem, et un modem 4G/5G réveillé
 * plus souvent que toutes les ~10 s ne s'endort jamais. Début, pause, reprise,
 * arrêt et changement de titre partent toujours tout de suite.
 *
 * App derrière, la progression part même au BATTEMENT de l'app (`beat()` : le
 * ping du socket, toutes les 30 s, modem déjà réveillé) — un battement sur
 * deux. Sans battement depuis 45 s (socket fermé), elle reprend son propre
 * délai de 60 s ; avec, un secours à 95 s si le battement venait à manquer.
 */

import type { MusicPlaybackReport, MusicTrack } from "../music";

export interface ReportSinks {
  library: (report: MusicPlaybackReport) => void;
  externalPlayed: (track: MusicTrack, completed: boolean) => void;
  now: () => number;
  /**
   * L'app est-elle derrière ? Absent (web, bureau) : toujours au premier plan,
   * la cadence d'avant. Relu à chaque position : un retour au premier plan
   * rattrape aussitôt une progression vieille de plus de 15 s.
   */
  background?: () => boolean;
}

/** Une progression toutes les 15 s suffit à Jellyfin (reprise, « écouté récemment »). */
export const PROGRESS_EVERY_MS = 15_000;
/** App derrière : personne ne regarde la barre de ce titre-ci, une minute suffit à la reprise. */
export const BACKGROUND_PROGRESS_EVERY_MS = 60_000;
/** Un battement part avec la progression dès qu'elle a presque une minute (battements à 30 s, gigue comprise). */
const BEAT_PROGRESS_EVERY_MS = BACKGROUND_PROGRESS_EVERY_MS - 5_000;
/** Battements vivants : le dernier date de moins de 45 s (un tous les 30 s). */
const BEAT_ALIVE_MS = 45_000;
/** Battements vivants, la progression n'attend jamais plus (un battement perdu). */
const BEAT_FALLBACK_MS = 95_000;
/** Au-delà de 90 % de la durée, l'écoute est menée au bout (contrat). */
const COMPLETED_RATIO = 0.9;

export class PlaybackReporter {
  private active: MusicTrack | null = null;
  private lastProgressAt = 0;
  /** Une pause a été dite : la reprise se dit au premier son, sans attendre les 15 s. */
  private pausedReported = false;
  /** La dernière position dite par le moteur en lecture, que le battement emporte (rien en pause). */
  private pendingPositionMs: number | null = null;
  private lastBeatAt: number | null = null;

  constructor(private readonly sinks: ReportSinks) {}

  started(track: MusicTrack, positionMs: number): void {
    if (this.active?.key === track.key) return;
    this.active = track;
    this.pausedReported = false;
    this.pendingPositionMs = null;
    this.lastProgressAt = this.sinks.now();
    if (track.jellyfinId && track.availability === "library") {
      this.sinks.library({ itemId: track.jellyfinId, positionMs, event: "start" });
    }
  }

  progress(positionMs: number): void {
    const track = this.active;
    if (!track?.jellyfinId || track.availability !== "library") return;
    const now = this.sinks.now();
    this.pendingPositionMs = positionMs;
    if (!this.pausedReported && now - this.lastProgressAt < this.progressEveryMs(now)) return;
    this.sendProgress(track.jellyfinId, positionMs, now);
  }

  /** Le battement de l'app (ping du socket) : app derrière, la progression due part avec lui. */
  beat(): void {
    const now = this.sinks.now();
    this.lastBeatAt = now;
    const track = this.active;
    const positionMs = this.pendingPositionMs;
    if (!track?.jellyfinId || track.availability !== "library" || positionMs === null) return;
    if (!this.sinks.background?.() || now - this.lastProgressAt < BEAT_PROGRESS_EVERY_MS) return;
    this.sendProgress(track.jellyfinId, positionMs, now);
  }

  paused(positionMs: number): void {
    const track = this.active;
    this.pendingPositionMs = null;
    if (track?.jellyfinId && track.availability === "library") {
      this.pausedReported = true;
      this.sinks.library({ itemId: track.jellyfinId, positionMs, event: "pause" });
    }
  }

  stopped(positionMs: number, durationMs: number | null): void {
    const track = this.active;
    if (!track) return;
    this.active = null;
    this.pendingPositionMs = null;
    const completed = durationMs !== null && durationMs > 0 && positionMs >= durationMs * COMPLETED_RATIO;
    if (track.jellyfinId && track.availability === "library") {
      this.sinks.library({ itemId: track.jellyfinId, positionMs, event: "stop", completed });
    } else if (track.external && completed) {
      this.sinks.externalPlayed(track, true);
    }
  }

  private sendProgress(itemId: string, positionMs: number, now: number): void {
    this.pausedReported = false;
    this.lastProgressAt = now;
    this.sinks.library({ itemId, positionMs, event: "progress" });
  }

  private progressEveryMs(now: number): number {
    if (!this.sinks.background?.()) return PROGRESS_EVERY_MS;
    const beating = this.lastBeatAt !== null && now - this.lastBeatAt <= BEAT_ALIVE_MS;
    return beating ? BEAT_FALLBACK_MS : BACKGROUND_PROGRESS_EVERY_MS;
  }
}
