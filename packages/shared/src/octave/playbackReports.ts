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
/** Au-delà de 90 % de la durée, l'écoute est menée au bout (contrat). */
const COMPLETED_RATIO = 0.9;

export class PlaybackReporter {
  private active: MusicTrack | null = null;
  private lastProgressAt = 0;
  /** Une pause a été dite : la reprise se dit au premier son, sans attendre les 15 s. */
  private pausedReported = false;

  constructor(private readonly sinks: ReportSinks) {}

  started(track: MusicTrack, positionMs: number): void {
    if (this.active?.key === track.key) return;
    this.active = track;
    this.pausedReported = false;
    this.lastProgressAt = this.sinks.now();
    if (track.jellyfinId && track.availability === "library") {
      this.sinks.library({ itemId: track.jellyfinId, positionMs, event: "start" });
    }
  }

  progress(positionMs: number): void {
    const track = this.active;
    if (!track?.jellyfinId || track.availability !== "library") return;
    const now = this.sinks.now();
    if (!this.pausedReported && now - this.lastProgressAt < this.progressEveryMs()) return;
    this.pausedReported = false;
    this.lastProgressAt = now;
    this.sinks.library({ itemId: track.jellyfinId, positionMs, event: "progress" });
  }

  paused(positionMs: number): void {
    const track = this.active;
    if (track?.jellyfinId && track.availability === "library") {
      this.pausedReported = true;
      this.sinks.library({ itemId: track.jellyfinId, positionMs, event: "pause" });
    }
  }

  stopped(positionMs: number, durationMs: number | null): void {
    const track = this.active;
    if (!track) return;
    this.active = null;
    const completed = durationMs !== null && durationMs > 0 && positionMs >= durationMs * COMPLETED_RATIO;
    if (track.jellyfinId && track.availability === "library") {
      this.sinks.library({ itemId: track.jellyfinId, positionMs, event: "stop", completed });
    } else if (track.external && completed) {
      this.sinks.externalPlayed(track, true);
    }
  }

  private progressEveryMs(): number {
    return this.sinks.background?.() ? BACKGROUND_PROGRESS_EVERY_MS : PROGRESS_EVERY_MS;
  }
}
