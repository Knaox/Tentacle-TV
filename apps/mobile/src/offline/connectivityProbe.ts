/**
 * La sonde du magasin de connectivité : `GET /api/health` puis
 * `GET /api/jellyfin/System/Info/Public`, délai commun de cinq secondes, la
 * cause de l'échec et la latence du backend pour la qualité du lien.
 *
 * La cause distingue le serveur de la connexion : une réponse rapide en
 * erreur (connexion refusée, 5xx) accuse le serveur — `"backend"`, ou
 * `"jellyfin"` derrière lui — ; notre délai dépassé, c'est `"timeout"` : la
 * connexion ne permet pas de joindre le serveur, et l'application passe sur
 * ce qui est sur l'appareil. « Juste lent » reste en ligne : les données
 * finissent par arriver.
 */

import { reportDatabaseState } from "@tentacle-tv/api-client";
import type { OfflineReason, ProbeMeasure } from "@tentacle-tv/offline-core";

export type { OfflineReason } from "@tentacle-tv/offline-core";

const PROBE_TIMEOUT_MS = 5_000;

export type ProbeResult = ProbeMeasure;

/** Backend puis Jellyfin (via proxy), délai commun de 5 s. */
export async function runProbe(base: string): Promise<ProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const startedAt = Date.now();
  // Seul notre minuteur interrompt la sonde : un abandon EST un délai dépassé.
  const failure = (serverSide: OfflineReason): OfflineReason =>
    controller.signal.aborted ? "timeout" : serverSide;
  try {
    const backendRes = await fetch(`${base}/api/health`, { signal: controller.signal });
    const latencyMs = Date.now() - startedAt;
    if (!backendRes.ok) return { ok: false, reason: "backend", latencyMs: null };
    // La base du serveur en migration : il RÉPOND — ni bascule hors ligne, ni
    // message de connectivité ; l'écran d'attente le dit (`DatabaseMigrationHost`).
    // Le proxy Jellyfin, fermé le temps de la copie, n'est pas sondé.
    if (reportDatabaseState(await backendRes.json().catch(() => null))) return { ok: true, reason: null, latencyMs };
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
      return { ok: false, reason: failure("jellyfin"), latencyMs };
    }
  } catch {
    return { ok: false, reason: failure("backend"), latencyMs: null };
  } finally {
    clearTimeout(timeout);
  }
}
