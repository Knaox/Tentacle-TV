/**
 * Octave — les sources de lecture déjà connues (contrat `PlaybackSource`).
 *
 * Une source demandée une fois ne se redemande pas : l'anticipation
 * (`press`, `next`, `hover`) la prépare, et le clic la trouve PRÊTE — c'est ce
 * qui rend l'attente invisible. Une demande en vol est partagée ; une source
 * expirée (`expiresAt`, avec une marge) est redemandée.
 */

import type { MusicTrack, PlaybackSource } from "../music";

/** L'extension n'a pas de source à cause de son budget de requêtes : réessayer dans ce délai (contrat `retry`). */
export interface ExternalRetry {
  retryAfterMs: number;
}

export interface SourceResolvers {
  /** Un titre de la bibliothèque (`/api/music/source/:id`). */
  library: (jellyfinId: string) => Promise<PlaybackSource>;
  /** Un titre d'extension (`music.resolve`) ; `null` : pas de source ; `{ retryAfterMs }` : réessayer plus tard. */
  external: (track: MusicTrack) => Promise<PlaybackSource | ExternalRetry | null>;
  now: () => number;
}

/** Une source qui expire dans moins de 10 s est déjà trop vieille pour démarrer. */
const EXPIRY_MARGIN_MS = 10_000;

export class SourceCache {
  private readonly sources = new Map<string, PlaybackSource>();
  private readonly inFlight = new Map<string, Promise<PlaybackSource | null>>();
  /** Le dernier « réessaie plus tard » de l'extension, par titre (`takeRetryHint`). */
  private readonly retryHints = new Map<string, number>();

  constructor(private readonly resolvers: SourceResolvers) {}

  /** La source prête, tout de suite — ou `null` (il faudra attendre `get`). */
  peek(trackKey: string): PlaybackSource | null {
    const source = this.sources.get(trackKey);
    if (!source) return null;
    if (source.expiresAt !== null && source.expiresAt - EXPIRY_MARGIN_MS <= this.resolvers.now()) {
      this.sources.delete(trackKey);
      return null;
    }
    return source;
  }

  get(track: MusicTrack): Promise<PlaybackSource | null> {
    const ready = this.peek(track.key);
    if (ready) return Promise.resolve(ready);
    const pending = this.inFlight.get(track.key);
    if (pending) return pending;
    // Une nouvelle demande : un ancien « réessaie plus tard » ne vaut plus.
    this.retryHints.delete(track.key);
    const request = this.resolve(track)
      .then((result) => {
        if (result !== null && "retryAfterMs" in result) {
          this.retryHints.set(track.key, result.retryAfterMs);
          return null;
        }
        if (result) this.sources.set(track.key, result);
        return result;
      })
      .catch(() => null)
      .finally(() => this.inFlight.delete(track.key));
    this.inFlight.set(track.key, request);
    return request;
  }

  put(trackKey: string, source: PlaybackSource): void {
    this.sources.set(trackKey, source);
  }

  invalidate(trackKey: string): void {
    this.sources.delete(trackKey);
  }

  /** Le délai demandé par l'extension pour ce titre (« réessaie plus tard »), une seule fois ; `null` sinon. */
  takeRetryHint(trackKey: string): number | null {
    const hint = this.retryHints.get(trackKey);
    this.retryHints.delete(trackKey);
    return hint ?? null;
  }

  private resolve(track: MusicTrack): Promise<PlaybackSource | ExternalRetry | null> {
    if (track.jellyfinId && track.availability === "library") return this.resolvers.library(track.jellyfinId);
    if (track.external) return this.resolvers.external(track);
    if (track.jellyfinId) return this.resolvers.library(track.jellyfinId);
    return Promise.resolve(null);
  }
}
