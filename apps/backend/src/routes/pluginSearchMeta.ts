/**
 * Le champ optionnel `search` d'un manifeste de plugin (`plugin.json`) : le
 * plugin sait trouver des titres que la bibliothèque n'a PAS, et la recherche
 * de Tentacle (barre globale, page de résultats, champ d'une bibliothèque) les
 * montre à part, sous le nom qu'il choisit. Contrat :
 *
 *   "search": {
 *     "path": "/search/provider",
 *     "types": ["movie", "series"],
 *     "labels": { "fr": "Pas encore sur le serveur", "en": "Not on the server yet" }
 *   }
 *
 * `path` est une route du serveur du plugin (donc servie sous
 * `/api/plugins/<id>`) ; elle reçoit `q`, `lang`, `limit` et, depuis une
 * bibliothèque, `type` (`movie` ou `series`), et rend
 * `{ query, correction, complete, items, moreHref }` — chaque élément portant
 * titre, image, lien vers une page du plugin et pastille éventuelle.
 *
 * Tentacle n'en sait pas plus : le plugin décide de ce qu'il trouve, le client
 * l'affiche. Comme pour `tab`, ce lecteur est la seule garde — un champ mal
 * formé est ignoré, jamais relayé à moitié.
 */
export type PluginSearchType = "movie" | "series";

export interface PluginSearchMeta {
  path: string;
  types?: PluginSearchType[];
  labels?: Record<string, string>;
}

/* Un chemin simple, sous la racine du plugin : ni schéma, ni remontée, ni requête. */
const SAFE_PATH = /^\/[A-Za-z0-9_\-/]{1,100}$/;
const TYPES: readonly PluginSearchType[] = ["movie", "series"];

export function readSearchMeta(manifest: unknown): PluginSearchMeta | undefined {
  if (!manifest || typeof manifest !== "object") return undefined;
  const search = (manifest as { search?: unknown }).search;
  if (!search || typeof search !== "object" || Array.isArray(search)) return undefined;
  const { path, types, labels } = search as { path?: unknown; types?: unknown; labels?: unknown };
  if (typeof path !== "string" || !SAFE_PATH.test(path) || path.includes("//")) return undefined;

  const out: PluginSearchMeta = { path };
  if (Array.isArray(types)) {
    const kept = TYPES.filter((type) => types.includes(type));
    if (kept.length > 0) out.types = kept;
  }
  if (labels && typeof labels === "object" && !Array.isArray(labels)) {
    const clean = Object.fromEntries(
      Object.entries(labels as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim() !== "",
      ).map(([lang, label]) => [lang, label.trim().slice(0, 60)]),
    );
    if (Object.keys(clean).length > 0) out.labels = clean;
  }
  return out;
}
