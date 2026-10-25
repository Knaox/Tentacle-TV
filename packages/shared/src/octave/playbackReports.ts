/**
 * Octave — le rapport d'écoute : à Jellyfin pour un titre de la bibliothèque
 * (`/api/music/playback` : start, progress, pause, stop), à l'extension pour
 * un titre hors bibliothèque (`music.played`, au bout seulement).
 */

import type { MusicPlaybackReport, MusicTrack } from "../music";

export interface ReportSinks {
  library: (report: MusicPlaybackReport) => void;
  externalPlayed: (track: MusicTrack, completed: boolean) => void;
  now: () => number;
}

/** Une progression toutes les 15 s suffit à Jellyfin (reprise, « écouté récemment »). */
const PROGRESS_EVERY_MS = 15_000;
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
    if (!this.pausedReported && now - this.lastProgressAt < PROGRESS_EVERY_MS) return;
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
}
