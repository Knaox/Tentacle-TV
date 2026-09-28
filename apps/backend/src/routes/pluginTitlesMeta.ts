/**
 * Le champ optionnel `titles` d'un manifeste de plugin (`plugin.json`) : le
 * plugin sait dire, d'un titre que la bibliothèque n'a PAS, où il en est et
 * comment l'obtenir — et Tentacle le montre sur ses propres cartes hors
 * bibliothèque (recommandations, résultats de recherche, filmographies), avec
 * les mêmes gestes que dans le plugin. Contrat :
 *
 *   "titles": {
 *     "state": "/titles/state",
 *     "request": "/titles/request"
 *   }
 *
 * Les deux sont des routes du serveur du plugin (servies sous
 * `/api/plugins/<id>`), qui identifient un titre par sa clé TMDB
 * (« movie:603 », « tv:1399 ») :
 *
 *   GET  state?keys=movie:603,tv:1399&lang=fr
 *     → { items: { "movie:603": { badge, request } } }
 *       badge   : { label, tone } | null — où en est le titre (« Demandé »…) ;
 *       request : { mode: "direct" | "open", label, href? } | null — le geste
 *                 offert : « direct » se fait sur place (POST request),
 *                 « open » ouvre la page du plugin à `href` (un choix à faire).
 *   POST request  { mediaType, tmdbId, lang }
 *     → { ok: true, message } | { ok: false, message } | { href }
 *
 * Tentacle n'en sait pas plus : le plugin décide de ce qu'il offre et de ses
 * mots, le client l'affiche. Comme pour `search`, ce lecteur est la seule
 * garde — un champ mal formé est ignoré, jamais relayé à moitié.
 */
export interface PluginTitlesMeta {
  state: string;
  /** Route du geste « demander », si le plugin en offre un. */
  request?: string;
}

/* Un chemin simple, sous la racine du plugin : ni schéma, ni remontée, ni requête. */
const SAFE_PATH = /^\/[A-Za-z0-9_\-/]{1,100}$/;

function isSafePath(value: unknown): value is string {
  return typeof value === "string" && SAFE_PATH.test(value) && !value.includes("//");
}

export function readTitlesMeta(manifest: unknown): PluginTitlesMeta | undefined {
  if (!manifest || typeof manifest !== "object") return undefined;
  const titles = (manifest as { titles?: unknown }).titles;
  if (!titles || typeof titles !== "object" || Array.isArray(titles)) return undefined;
  const { state, request } = titles as { state?: unknown; request?: unknown };
  if (!isSafePath(state)) return undefined;
  const out: PluginTitlesMeta = { state };
  // Mal formée, la demande est ignorée seule : l'état, lui, reste valable.
  if (isSafePath(request)) out.request = request;
  return out;
}
