/**
 * Octave — « Lecture dans un instant… » : l'extension n'a pas rendu de source
 * PARCE QUE son budget de requêtes est atteint (contrat `retry` de
 * `music.resolve`), pas faute de source. Le lecteur ne passe pas au suivant et
 * ne compte pas cet essai dans la série d'échecs : il attend le délai demandé
 * (borné à 10 s) puis réessaie UNE fois — sauf si l'utilisateur a changé de
 * titre entre-temps.
 */

import type { MusicTrack, PlaybackSource } from "../music";
import type { SourceCache } from "./sourceCache";

export const RETRY_MAX_WAIT_MS = 10_000;

export interface SourceRetryHooks {
  /** Le titre est toujours celui que l'utilisateur attend. */
  current: () => boolean;
  notice: (notice: "retrySoon" | null) => void;
  /** Le second essai : une source, ou `null` (l'échec ordinaire, alors). */
  done: (source: PlaybackSource | null) => void;
  setTimeout?: (fn: () => void, ms: number) => unknown;
}

/** Vrai si un nouvel essai est programmé (l'extension a dit « réessaie plus tard ») ; faux : un échec ordinaire. */
export function scheduleSourceRetry(sources: SourceCache, track: MusicTrack, hooks: SourceRetryHooks): boolean {
  const hint = sources.takeRetryHint(track.key);
  if (hint === null) return false;
  hooks.notice("retrySoon");
  (hooks.setTimeout ?? setTimeout)(() => {
    if (!hooks.current()) return;
    void sources.get(track).then((source) => {
      if (!hooks.current()) return;
      // Un second « réessaie plus tard » ne relance rien : une seule fois.
      sources.takeRetryHint(track.key);
      hooks.notice(null);
      hooks.done(source);
    });
  }, Math.min(Math.max(0, hint), RETRY_MAX_WAIT_MS));
  return true;
}
