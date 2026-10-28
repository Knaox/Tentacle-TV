/**
 * Octave (mobile) — le plafond GÉNÉRIQUE de l'appareil, par extension : quoi que l'extension croie de son
 * propre budget, le téléphone n'exécute pas plus de 4 requêtes à la fois, 30 par minute, 300 par heure pour
 * elle. Au-delà : `budget`, sans rien envoyer. La règle du bureau
 * (`apps/desktop-electron/src/main/clientFetch/clientFetchQuota.ts`), sur les mêmes bornes partagées. Pur.
 */

import { CLIENT_FETCH_LIMITS } from "@tentacle-tv/shared/pluginClientFetch";

const MINUTE = 60_000;
const HOUR = 3_600_000;

export class ClientFetchQuota {
  private readonly starts = new Map<string, number[]>();
  private readonly running = new Map<string, number>();

  constructor(private readonly now: () => number = Date.now) {}

  /** Une place pour `pluginId` ; `null` : refusée. La place se rend par la fonction rendue. */
  take(pluginId: string): (() => void) | null {
    const t = this.now();
    const recent = (this.starts.get(pluginId) ?? []).filter((at) => t - at < HOUR);
    const busy = this.running.get(pluginId) ?? 0;
    if (busy >= CLIENT_FETCH_LIMITS.maxParallel) return null;
    if (recent.length >= CLIENT_FETCH_LIMITS.perHour) return null;
    if (recent.filter((at) => t - at < MINUTE).length >= CLIENT_FETCH_LIMITS.perMinute) return null;
    recent.push(t);
    this.starts.set(pluginId, recent);
    this.running.set(pluginId, busy + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.running.set(pluginId, Math.max(0, (this.running.get(pluginId) ?? 1) - 1));
    };
  }
}
