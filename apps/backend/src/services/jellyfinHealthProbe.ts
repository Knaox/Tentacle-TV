import { Agent, fetch as undiciFetch } from "undici";
import { jellyfinAuthHeaders } from "./jellyfinAuth";
import type { ProbeVerdict } from "./jellyfinHealthMachine";

/**
 * La sonde de `jellyfinHealthMachine.ts` : `GET /System/Info/Public`, sans
 * authentification, délai court.
 *
 * Ce qui distingue un vrai retour (mesuré sur 10.11.11) : le serveur répond
 * en PascalCase avec son `Id`. Pendant le démarrage, le serveur d'attente de
 * 10.11 répond une fois 200 en camelCase SANS `Id`, puis 503 « Jellyfin
 * Server is loading » : les deux veulent dire « il arrive », pas « il est là ».
 *
 * Et l'`Id` ne suffit pas : relevé sur un 10.11.11 (session « Passages »,
 * 2026-10-06), `/System/Info/Public` le rend ~25 s AVANT que l'API
 * authentifiée cesse de répondre 503 (sonde ffmpeg du démarrage). D'où une
 * deuxième preuve, un appel authentifié léger (`/System/Info`, clé d'API) :
 * 503 = il démarre encore. Un 401/403 dit Jellyfin LÀ (la clé est un autre
 * problème, dit ailleurs) ; sans clé configurée, l'`Id` fait foi.
 */

export const PROBE_TIMEOUT_MS = 3_000;

/** Une connexion neuve par sonde : un socket gardé d'avant le redémarrage répondrait « fermé ». */
const freshConnections = new Agent({ keepAliveTimeout: 1, keepAliveMaxTimeout: 1, pipelining: 0 });

/** Le verdict d'une réponse — pur. */
export function classifyProbe(status: number, body: string): ProbeVerdict {
  if (status === 503) return "starting";
  if (status < 200 || status >= 300) return "fail";
  try {
    const info = JSON.parse(body) as { Id?: unknown } | null;
    return typeof info?.Id === "string" && info.Id !== "" ? "ok" : "starting";
  } catch {
    return "fail";
  }
}

/** Le verdict de la deuxième preuve, l'appel authentifié — pur. */
export function classifyAuthProbe(status: number): ProbeVerdict {
  if (status === 503) return "starting";
  if ((status >= 200 && status < 300) || status === 401 || status === 403) return "ok";
  return "fail";
}

/** Interroge Jellyfin à l'adresse donnée ; ne lève jamais. */
export async function probeJellyfinHealth(baseUrl: string | undefined, apiKey?: string): Promise<ProbeVerdict> {
  if (!baseUrl) return "fail";
  const base = baseUrl.replace(/\/$/, "");
  try {
    const res = await undiciFetch(`${base}/System/Info/Public`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      dispatcher: freshConnections,
    });
    const verdict = classifyProbe(res.status, await res.text());
    if (verdict !== "ok" || !apiKey) return verdict;
    const auth = await undiciFetch(`${base}/System/Info`, {
      headers: jellyfinAuthHeaders(apiKey),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      dispatcher: freshConnections,
    });
    await auth.body?.cancel();
    return classifyAuthProbe(auth.status);
  } catch {
    return "fail";
  }
}
