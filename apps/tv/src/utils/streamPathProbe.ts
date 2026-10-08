import { reportMaintenanceResponse, type useJellyfinClient } from "@tentacle-tv/api-client";
import type { Culprit } from "@tentacle-tv/tv-core";
import { nativePlayerHeaders } from "./nativePlayerHeaders";

/** Au-delà, pas de réponse : le serveur est tenu pour muet. */
const PROBE_TIMEOUT_MS = 4000;
/** Le lecteur attend sa fiche : on tranche plus vite. */
const TENTACLE_PROBE_TIMEOUT_MS = 3000;

export interface StreamPathProbe {
  ok: boolean;
  /** Qui manque quand le chemin ne répond pas. */
  culprit: Culprit | null;
}

/**
 * Le chemin que prend le flux répond-il ? Le MÊME que celui du lecteur :
 * Jellyfin en direct quand le streaming direct est actif, sinon le proxy de
 * Tentacle — et la même authentification que le lecteur natif. Par le proxy,
 * un 503 du mode maintenance (base du serveur en migration) accuse Tentacle.
 *
 * `System/Info/Public` : la plus légère des réponses de Jellyfin, sans
 * session, autorisée par le proxy. Par le proxy, un 502/504 dit que Tentacle
 * répond et que Jellyfin, derrière, ne répond pas ; aucune réponse dit que
 * c'est Tentacle qui manque.
 */
export async function probeStreamPath(client: ReturnType<typeof useJellyfinClient>): Promise<StreamPathProbe> {
  const direct = client.getDirectStreaming?.();
  const base = direct?.mediaBaseUrl ?? client.getBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/System/Info/Public`, {
      headers: nativePlayerHeaders(client),
      signal: controller.signal,
    });
    if (await jellyfinServes(res)) return { ok: true, culprit: null };
    // Le proxy fermé le temps de la migration de la base (503 du mode
    // maintenance) : c'est Tentacle qui manque, jamais Jellyfin en panne. Seul
    // le proxy de Tentacle peut le dire : un Jellyfin joint en direct, jamais.
    const maintenance = !direct && (await reportMaintenanceResponse(res));
    return { ok: false, culprit: maintenance ? "tentacle" : "media" };
  } catch {
    return { ok: false, culprit: direct ? "media" : "tentacle" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Jellyfin SERT-il vraiment ? Mesuré sur 10.11.11 (2026-10-05) : pendant son
 * démarrage, le serveur d'attente répond UNE fois 200 à `System/Info/Public`,
 * en camelCase et sans `Id`, puis 503 « loading » plusieurs secondes. Croire
 * ce 200 relançait le flux ~6 s trop tôt, pour une relance vaine (deux
 * vaines : la main rendue à l'utilisateur). Le vrai serveur répond en
 * PascalCase avec son `Id` — la règle de la sonde du backend
 * (`jellyfinHealthProbe.ts`).
 */
async function jellyfinServes(res: Response): Promise<boolean> {
  if (!res.ok) return false;
  try {
    const info = (await res.json()) as { Id?: unknown } | null;
    return typeof info?.Id === "string" && info.Id !== "";
  } catch {
    return false;
  }
}

/**
 * Tentacle répond-il, quoi qu'il dise ? Le proxy, sans la voie directe :
 * n'importe quelle réponse HTTP (un 502 quand Jellyfin manque derrière) dit
 * qu'il est là ; aucune réponse, qu'il est muet. Pour la fiche du lecteur
 * (`usePlayerItem`), qui ne cherche ailleurs que s'il est muet.
 */
export async function tentacleAnswers(client: ReturnType<typeof useJellyfinClient>): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TENTACLE_PROBE_TIMEOUT_MS);
  try {
    await fetch(`${client.getBaseUrl()}/System/Info/Public`, { signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
