/**
 * La sonde du magasin de connectivité : `GET /api/health` puis
 * `GET /api/jellyfin/System/Info/Public`, délai commun de cinq secondes, la
 * cause de l'échec et la latence du backend pour la qualité du lien.
 */

/**
 * Pourquoi on est hors ligne. `"network"` ne vient jamais d'une sonde — c'est
 * le téléphone qui n'a pas de lien, et il n'y a rien eu à sonder.
 */
export type OfflineReason = "backend" | "jellyfin" | "network" | null;

const PROBE_TIMEOUT_MS = 5_000;

export interface ProbeResult {
  ok: boolean;
  reason: OfflineReason;
  /** Latence de `/api/health` en ms — `null` si la sonde a échoué. */
  latencyMs: number | null;
}

/** Backend puis Jellyfin (via proxy), délai commun de 5 s. */
export async function runProbe(base: string): Promise<ProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const backendRes = await fetch(`${base}/api/health`, { signal: controller.signal });
    const latencyMs = Date.now() - startedAt;
    if (!backendRes.ok) return { ok: false, reason: "backend", latencyMs: null };
    try {
      const jellyfinRes = await fetch(`${base}/api/jellyfin/System/Info/Public`, {
        signal: controller.signal,
      });
      // 503 = Jellyfin non configuré (assistant) → ne bascule PAS hors ligne.
      if (jellyfinRes.status === 503) return { ok: true, reason: null, latencyMs };
      return jellyfinRes.ok
        ? { ok: true, reason: null, latencyMs }
        : { ok: false, reason: "jellyfin", latencyMs };
    } catch {
      return { ok: false, reason: "jellyfin", latencyMs };
    }
  } catch {
    return { ok: false, reason: "backend", latencyMs: null };
  } finally {
    clearTimeout(timeout);
  }
}
