import type { useJellyfinClient } from "@tentacle-tv/api-client";
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
 * Tentacle — et la même authentification que le lecteur natif.
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
    return res.ok ? { ok: true, culprit: null } : { ok: false, culprit: "media" };
  } catch {
    return { ok: false, culprit: direct ? "media" : "tentacle" };
  } finally {
    clearTimeout(timer);
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
