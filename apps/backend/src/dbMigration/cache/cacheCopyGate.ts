/**
 * La PORTE des tâches gourmandes en TMDB (génération des recommandations,
 * crawler de plateformes, tendances) : elles attendent que la copie de fond du
 * cache TMDB soit finie — sinon elles redemanderaient à TMDB des milliers de
 * fiches que la copie apporte —, avec un PLAFOND : 30 min, ou la fin de la
 * copie quelle qu'elle soit (réussite, arrêt). Jamais bloquées pour toujours.
 */
export const CACHE_WAIT_CAP_MS = 30 * 60_000;

let gate: Promise<void> | null = null;

/** Posée au démarrage quand une copie de fond part ; rien posé = rien à attendre. */
export function setCacheCopyGate(done: Promise<void>): void {
  gate = done.catch(() => undefined);
}

export function whenCachesReady(capMs: number = CACHE_WAIT_CAP_MS): Promise<void> {
  if (!gate) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, capMs);
    timer.unref?.();
    void gate!.then(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/** Les tests. */
export function resetCacheCopyGate(): void {
  gate = null;
}
