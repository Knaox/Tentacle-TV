/**
 * Octave — l'ATTENTE d'une source qui n'était pas prête :
 * - « Lecture dans un instant… » dès que la source tarde (`SLOW_START_MS`, 800 ms : S7 du plan de R8 — un titre
 *   que le lecteur rapide refuse, âge ou « made for kids », passe par le repli lent de l'extension, 2 à 4 s) ;
 * - l'extension n'a pas rendu de source PARCE QUE son budget de requêtes est atteint (contrat `retry` de
 *   `music.resolve`), pas faute de source : le lecteur ne passe pas au suivant et ne compte pas cet essai dans
 *   la série d'échecs ; il attend le délai demandé (borné à 10 s) puis réessaie — UNE fois pour un titre que la
 *   file enchaîne, jusqu'à trois pour un titre que l'utilisateur a CHOISI ;
 * - l'utilisateur a changé de titre entre-temps : plus rien ne part pour l'ancien.
 */

import type { MusicTrack, PlaybackSource } from "../music";
import type { SourceCache, SourceIntent } from "./sourceCache";

export const RETRY_MAX_WAIT_MS = 10_000;
/** Au-delà, l'attente se dit (« Lecture dans un instant… ») : le son ne vient pas tout de suite. */
export const SLOW_START_MS = 800;

export interface SourceRetryHooks {
  /** Le titre est toujours celui que l'utilisateur attend. */
  current: () => boolean;
  notice: (notice: "retrySoon" | null) => void;
  /** Le dernier essai : une source, ou `null` (l'échec ordinaire, alors). */
  done: (source: PlaybackSource | null) => void;
  setTimeout?: (fn: () => void, ms: number) => unknown;
}

/**
 * Vrai si un nouvel essai est programmé (l'extension a dit « réessaie plus tard ») ; faux : un échec ordinaire.
 * `tries` : les nouveaux essais permis tant que l'extension redit « réessaie plus tard ».
 */
export function scheduleSourceRetry(sources: SourceCache, track: MusicTrack, hooks: SourceRetryHooks, tries = 1, intent: SourceIntent = "play"): boolean {
  const hint = sources.takeRetryHint(track.key);
  if (hint === null || tries < 1) return false;
  hooks.notice("retrySoon");
  (hooks.setTimeout ?? setTimeout)(() => {
    if (!hooks.current()) return;
    void sources.get(track, intent).then((source) => {
      if (!hooks.current()) return;
      // Encore « réessaie plus tard » : un essai de plus s'il en reste, sinon l'échec ordinaire.
      if (!source && scheduleSourceRetry(sources, track, hooks, tries - 1, intent)) return;
      sources.takeRetryHint(track.key);
      hooks.notice(null);
      hooks.done(source);
    });
  }, Math.min(Math.max(0, hint), RETRY_MAX_WAIT_MS));
  return true;
}

export interface SourceWait extends SourceRetryHooks {
  intent: SourceIntent;
  /** Nouveaux essais permis sur « réessaie plus tard ». */
  tries: number;
}

/** Demande la source et l'attend : avis si elle tarde, nouveaux essais si le budget de l'extension l'exige. */
export function waitForSource(sources: SourceCache, track: MusicTrack, wait: SourceWait): void {
  let settled = false;
  (wait.setTimeout ?? setTimeout)(() => {
    if (!settled && wait.current()) wait.notice("retrySoon");
  }, SLOW_START_MS);
  void sources.get(track, wait.intent).then((source) => {
    if (!wait.current()) return;
    const finish = (s: PlaybackSource | null) => {
      settled = true;
      wait.done(s);
    };
    if (!source && scheduleSourceRetry(sources, track, { ...wait, done: finish }, wait.tries, wait.intent)) return;
    settled = true;
    wait.notice(null);
    wait.done(source);
  });
}
