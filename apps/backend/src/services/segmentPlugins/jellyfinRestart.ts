import { getJellyfinUrl } from "../configStore";
import { jellyfinAdminFetch } from "../jellyfinAdminFetch";
import type { SegmentRestartOutcome } from "./segmentPluginsContract";

/**
 * Redémarrer Jellyfin pour charger un greffon, par SON API — jamais par Docker
 * (le serveur ne parle pas au démon). `POST /System/Restart` relance l'hôte
 * DANS le même processus : le conteneur ne s'arrête pas, aucune politique de
 * relance n'est en jeu. Mesuré : 10.11.11 revient en 5 s puis finit de
 * démarrer en 30 s ; 12.1.0 en 3 s.
 *
 * « Revenu » se juge en deux temps, mesurés eux aussi :
 *  1. `/System/Info/Public` rend son `Id` (le serveur d'attente rend un 200
 *     sans `Id`) ;
 *  2. une route authentifiée (`/Plugins`) rend du JSON — 10.11 sert `Id`
 *     pendant que le reste répond encore 503 « en cours de chargement ».
 * Et on attend d'abord de le voir TOMBER : juste après la demande, l'ancien
 * processus répond encore.
 */

export interface RestartClock {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

const realClock: RestartClock = { now: () => Date.now(), sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) };

export const RESTART_TIMINGS = {
  /** Le temps de le voir s'arrêter ; au-delà, on juge sur pièces. */
  downWithinMs: 30_000,
  /** Le temps total de revenir (10.11 sur une petite machine : bien plus que 30 s). */
  backWithinMs: 240_000,
  pollMs: 1000,
};

/** Une lecture en cours sur ce Jellyfin (n'importe quel client, pas seulement Tentacle). */
export async function someoneIsWatching(): Promise<boolean | null> {
  const res = await jellyfinAdminFetch("/Sessions?activeWithinSeconds=960");
  if (!res.ok || !Array.isArray(res.data)) return null;
  return res.data.some((session) => typeof session === "object" && session !== null && "NowPlayingItem" in session && (session as { NowPlayingItem?: unknown }).NowPlayingItem != null);
}

async function publicId(): Promise<string | null> {
  const url = getJellyfinUrl();
  if (!url) return null;
  try {
    const res = await fetch(`${url}/System/Info/Public`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const info = (await res.json()) as { Id?: unknown };
    return typeof info.Id === "string" && info.Id ? info.Id : null;
  } catch {
    return null;
  }
}

async function fullyUp(): Promise<boolean> {
  if (!(await publicId())) return false;
  const res = await jellyfinAdminFetch("/Plugins", { timeoutMs: 4000 });
  return res.ok && Array.isArray(res.data);
}

/** Attend que Jellyfin tombe puis revienne. Faux si le temps est écoulé. */
export async function waitForRestart(clock: RestartClock = realClock): Promise<boolean> {
  const start = clock.now();
  let sawDown = false;
  while (clock.now() - start < RESTART_TIMINGS.downWithinMs) {
    if (!(await publicId())) {
      sawDown = true;
      break;
    }
    await clock.sleep(RESTART_TIMINGS.pollMs / 4);
  }
  // Jamais vu tomber : un redémarrage plus rapide que la sonde — on juge sur l'état.
  if (!sawDown && (await fullyUp())) return true;
  while (clock.now() - start < RESTART_TIMINGS.backWithinMs) {
    if (await fullyUp()) return true;
    await clock.sleep(RESTART_TIMINGS.pollMs);
  }
  return false;
}

/**
 * Redémarre Jellyfin et attend son retour — sauf si quelqu'un regarde et que
 * l'administrateur ne l'a pas demandé expressément.
 */
export async function restartJellyfin(options: { whilePlaying: boolean }, clock: RestartClock = realClock): Promise<SegmentRestartOutcome> {
  if (!options.whilePlaying && (await someoneIsWatching()) === true) return "deferred-playing";
  const res = await jellyfinAdminFetch("/System/Restart", { method: "POST", expectEmpty: true });
  if (!res.ok) return "failed";
  return (await waitForRestart(clock)) ? "done" : "timeout";
}

/** Jellyfin attend-il un redémarrage (greffon posé, réglage pris) ? */
export async function restartPending(): Promise<boolean> {
  const res = await jellyfinAdminFetch<{ HasPendingRestart?: unknown }>("/System/Info");
  return res.ok && res.data?.HasPendingRestart === true;
}
