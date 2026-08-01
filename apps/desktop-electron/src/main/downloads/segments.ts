/**
 * Segments « passer l'intro » et « passer le générique », persistés au
 * snapshot.
 *
 * Les trois sources qu'interroge `useIntroSkipper` — `MediaSegments` natif de
 * Jellyfin 10.9+, et le greffon intro-skipper dans ses deux formats — sont
 * enregistrées BRUTES dans `meta/<itemId>/segments.json`. La normalisation
 * reste côté TypeScript (`normalizeSkipSegments`, `api-client`) : aucune
 * logique n'est dupliquée ici, et la lecture locale ne demande rien au réseau.
 *
 * Portage de `apps/desktop/src-tauri/src/downloads/segments_snapshot.rs`.
 */

import { MAX_JSON_BYTES, type FetchBytes } from "./fetcher";
import { parseJson } from "./json";
import { saveBytes } from "./meta";

/**
 * Le JSON brut si les octets en sont, sinon `null`.
 *
 * Une source muette rend souvent autre chose que du JSON — un 404 du greffon
 * absent, une page d'erreur HTML. L'écrire tel quel casserait le fichier
 * entier au moment de le relire.
 */
function jsonOuNull(bytes: Uint8Array | null): string {
  if (bytes === null) return "null";
  return parseJson(bytes) === null ? "null" : Buffer.from(bytes).toString("utf8");
}

/**
 * Récupère les trois sources et écrit `segments.json`.
 *
 * `true` si au moins une source a répondu ET que le fichier est écrit. Sinon
 * rien n'est écrit, et le lecteur local retombe sur les chapitres du DTO.
 */
export async function fetchAndSave(
  fetchBytes: FetchBytes,
  base: string,
  root: string,
  itemId: string,
  isEpisode: boolean,
): Promise<boolean> {
  const mediaSegments = await fetchBytes(
    `${base}/MediaSegments/${itemId}?includeSegmentTypes=Intro,Outro`,
    MAX_JSON_BYTES,
  );

  // Les routes du greffon intro-skipper n'existent que pour les épisodes.
  const pluginDict = isEpisode
    ? await fetchBytes(`${base}/Episode/${itemId}/IntroSkipperSegments`, MAX_JSON_BYTES)
    : null;
  const pluginTs = isEpisode
    ? await fetchBytes(`${base}/Episode/${itemId}/Timestamps`, MAX_JSON_BYTES)
    : null;

  if (mediaSegments === null && pluginDict === null && pluginTs === null) return false;

  const corps =
    `{"mediaSegments":${jsonOuNull(mediaSegments)},` +
    `"pluginDict":${jsonOuNull(pluginDict)},` +
    `"pluginTs":${jsonOuNull(pluginTs)}}`;
  return saveBytes(root, `meta/${itemId}/segments.json`, Buffer.from(corps, "utf8"));
}
