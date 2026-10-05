import { Agent, fetch as undiciFetch } from "undici";
import type { ProbeVerdict } from "./jellyfinHealthMachine";

/**
 * La sonde de `jellyfinHealthMachine.ts` : `GET /System/Info/Public`, sans
 * authentification, délai court.
 *
 * Ce qui distingue un vrai retour (mesuré sur 10.11.11) : le serveur répond
 * en PascalCase avec son `Id`. Pendant le démarrage, le serveur d'attente de
 * 10.11 répond une fois 200 en camelCase SANS `Id`, puis 503 « Jellyfin
 * Server is loading » : les deux veulent dire « il arrive », pas « il est là ».
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

/** Interroge Jellyfin à l'adresse donnée ; ne lève jamais. */
export async function probeJellyfinHealth(baseUrl: string | undefined): Promise<ProbeVerdict> {
  if (!baseUrl) return "fail";
  try {
    const res = await undiciFetch(`${baseUrl.replace(/\/$/, "")}/System/Info/Public`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      dispatcher: freshConnections,
    });
    return classifyProbe(res.status, await res.text());
  } catch {
    return "fail";
  }
}
