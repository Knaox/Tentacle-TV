/**
 * Les segments de lecture, persistés au snapshot — au format RÉSOLU.
 *
 * Depuis la refonte, le résolveur unique vit côté backend
 * (`GET /api/playback/segments/:itemId`) : on enregistre sa réponse (contrat
 * v1) TELLE QUELLE dans `meta/<itemId>/segments.json`. Plus aucune source
 * brute ici — trois requêtes deviennent une, et la lecture locale n'a plus
 * rien à décider.
 *
 * La garde d'écriture est MINIMALE (c'est bien le contrat, pas une page
 * d'erreur) : la relecture qui fait foi vit côté renderer, dans
 * `parsePlaybackSegmentsResponse` (@tentacle-tv/shared) — le main est compilé
 * par tsc sans dépendre de shared, comme le backend. Les fichiers de l'ANCIEN
 * format (trois payloads bruts) restent lisibles côté renderer, et la
 * réparation (meta v3) les re-photographie au prochain démarrage en ligne.
 */

import type { Volume } from "./adapters";
import { MAX_JSON_BYTES, type FetchBytes } from "./fetcher";
import { parseJson } from "./json";
import { saveBytes } from "./meta";
import { mediaFileExists, safeJoin } from "./paths";

/** Le corps est-il un contrat v1 plausible ? (relecture stricte côté lecture) */
function plausibleContract(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null) return false;
  const o = raw as Record<string, unknown>;
  return o.version === 1 && typeof o.itemId === "string" && Array.isArray(o.segments);
}

/**
 * Récupère la réponse du résolveur et écrit `segments.json`.
 *
 * `true` si le contrat est plausible ET écrit. Sinon rien n'est écrit — la
 * lecture locale retombe sur un ancien fichier s'il existe, ou sur rien.
 */
export async function fetchAndSave(
  fetchBytes: FetchBytes,
  serverUrl: string,
  volume: Volume,
  itemId: string,
): Promise<boolean> {
  const bytes = await fetchBytes(`${serverUrl}/api/playback/segments/${itemId}`, MAX_JSON_BYTES);
  if (bytes === null) return false;

  const contract = parseJson(bytes);
  if (!plausibleContract(contract)) return false;

  return saveBytes(volume, `meta/${itemId}/segments.json`, bytes);
}

/** Le contrat a-t-il été pris pendant une analyse serveur encore en cours ? */
export function analysisPending(raw: unknown): boolean {
  return plausibleContract(raw) && (raw as Record<string, unknown>).analysisPending === true;
}

/**
 * `segments.json` porte une analyse en attente : l'intro ou le générique
 * manquaient peut-être quand il a été pris. À redemander au prochain démarrage
 * en ligne — une petite requête par item concerné, tant que l'analyse n'a pas
 * abouti. Absent ou illisible : rien à rafraîchir ici (le re-snapshot s'en
 * charge).
 */
export function needsRefresh(volume: Volume, itemId: string): boolean {
  const rel = `meta/${itemId}/segments.json`;
  if (!mediaFileExists(volume, rel)) return false;
  try {
    return analysisPending(JSON.parse(volume.files.readText(safeJoin(volume, rel))));
  } catch {
    return false;
  }
}
