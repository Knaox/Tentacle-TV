/**
 * Le démarrage du moteur AVANT d'entrer dans Octave : la bascule le lance au
 * GESTE (pointeur enfoncé, touche), pas au changement de page — mpv a ainsi
 * ~100 ms d'avance. Rien au survol ni avant : un moteur qui tourne sans être
 * affiché est interdit, et celui-ci s'arrête seul s'il n'est pas repris par
 * `AudioEngineProvider` dans `PRESTART_ADOPT_MS`.
 */

import type { AudioEnginePort } from "@tentacle-tv/shared/music";
import { createAudioEngine } from "./createAudioEngine";
import type { MusicEngineAuth } from "./engineShared";
import type { EnginePrefs } from "./mpv/mpvAudioEngine";

export const PRESTART_ADOPT_MS = 4000;

interface Prestarted {
  key: string;
  engine: Promise<AudioEnginePort>;
  timer: ReturnType<typeof setTimeout>;
}

let pending: Prestarted | null = null;

/** Le même moteur pour la même session : serveur, jeton, mode cookie. */
export function engineAuthKey(auth: MusicEngineAuth): string {
  return `${auth.baseUrl}|${auth.token ?? ""}|${auth.useCredentials ? 1 : 0}`;
}

export function prestartAudioEngine(auth: MusicEngineAuth, prefs: EnginePrefs, start: typeof createAudioEngine = createAudioEngine): void {
  const key = engineAuthKey(auth);
  if (pending?.key === key) return;
  dropPrestarted();
  const engine = start(auth, prefs);
  const timer = setTimeout(dropPrestarted, PRESTART_ADOPT_MS);
  pending = { key, engine, timer };
}

/** Le moteur démarré au geste pour CETTE session, une seule fois ; `null` sinon. */
export function adoptPrestartedEngine(auth: MusicEngineAuth): Promise<AudioEnginePort> | null {
  if (pending === null || pending.key !== engineAuthKey(auth)) return null;
  const { engine, timer } = pending;
  clearTimeout(timer);
  pending = null;
  return engine;
}

/** Jamais repris : arrêté (le geste n'a pas mené dans Octave). */
function dropPrestarted(): void {
  if (pending === null) return;
  const { engine, timer } = pending;
  clearTimeout(timer);
  pending = null;
  engine.then((e) => e.dispose(), () => undefined);
}
