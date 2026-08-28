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

import { MAX_JSON_BYTES, type FetchBytes } from "./fetcher";
import { parseJson } from "./json";
import { saveBytes } from "./meta";

/** Le corps est-il un contrat v1 plausible ? (relecture stricte côté lecture) */
function contratPlausible(brut: unknown): boolean {
  if (typeof brut !== "object" || brut === null) return false;
  const o = brut as Record<string, unknown>;
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
  root: string,
  itemId: string,
): Promise<boolean> {
  const bytes = await fetchBytes(`${serverUrl}/api/playback/segments/${itemId}`, MAX_JSON_BYTES);
  if (bytes === null) return false;

  const contrat = parseJson(bytes);
  if (!contratPlausible(contrat)) return false;

  return saveBytes(root, `meta/${itemId}/segments.json`, Buffer.from(bytes));
}
