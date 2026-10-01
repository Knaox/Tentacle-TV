/**
 * Le champ optionnel `titles` d'un manifeste de plugin (`plugin.json`) : le
 * plugin sait dire, d'un titre que la bibliothèque n'a PAS, où il en est et
 * comment l'obtenir — et Tentacle le montre sur ses propres cartes hors
 * bibliothèque (recommandations, résultats de recherche, filmographies), avec
 * les mêmes gestes que dans le plugin. Contrat :
 *
 *   "titles": {
 *     "state": "/titles/state",
 *     "request": "/titles/request",
 *     "access": "/titles/access",
 *     "mine": "/titles/mine",
 *     "seasons": "/titles/seasons"
 *   }
 *
 * Ce sont des routes du serveur du plugin (servies sous `/api/plugins/<id>`),
 * qui identifient un titre par sa clé TMDB (« movie:603 », « tv:1399 ») :
 *
 *   GET  state?keys=movie:603,tv:1399&lang=fr
 *     → { items: { "movie:603": { badge, request } } }
 *       badge   : { label, tone } | null — où en est le titre (« Demandé »…) ;
 *       request : { mode: "direct" | "open", label, href? } | null — le geste
 *                 offert : « direct » se fait sur place (POST request),
 *                 « open » ouvre la page du plugin à `href` (un choix à faire).
 *   POST request  { mediaType, tmdbId, lang }
 *     → { ok: true, message } | { ok: false, message } | { href }
 *   GET  access
 *     → { request: boolean } — le compte peut-il demander quoi que ce soit
 *       (faux : compte bloqué, aucun type permis). Un client peut s'en servir
 *       pour n'offrir AUCUNE fonction du plugin à un compte qui n'y a pas droit.
 *   GET  mine?lang=fr
 *     → { items: [{ key, title, year, imageUrl, seasons, state, percent }] }
 *       les titres que le compte attend — demandés, pas encore dans la
 *       bibliothèque —, un par titre, les plus récents d'abord ; `state` :
 *       pending | arriving (`percent` 0-100, ou null) | importing | blocked.
 *       Seul l'état voyage : les mots sont ceux du client.
 *   GET  seasons?key=tv:1399&lang=fr
 *     → { seasons: [{ number, name, episodeCount, badge, requestable }] } —
 *       les saisons d'une série, pour un client qui les choisit lui-même ;
 *       la demande part alors par `request`, avec `seasons: [1, 2]`.
 *
 * Tentacle n'en sait pas plus : le plugin décide de ce qu'il offre et de ses
 * mots (sauf les états de `mine`), le client l'affiche. Comme pour `search`,
 * ce lecteur est la seule garde — un champ mal formé est ignoré, jamais
 * relayé à moitié. `access`, `mine` et `seasons` sont venus après : un plugin
 * qui ne les déclare pas garde exactement le contrat d'avant.
 */
export interface PluginTitlesMeta {
  state: string;
  /** Route du geste « demander », si le plugin en offre un. */
  request?: string;
  /** Route du droit du compte (`{ request }`), si le plugin la déclare. */
  access?: string;
  /** Route des titres que le compte attend, si le plugin la déclare. */
  mine?: string;
  /** Route des saisons d'une série, si le plugin la déclare. */
  seasons?: string;
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
  const { state, request, access, mine, seasons } = titles as Record<string, unknown>;
  if (!isSafePath(state)) return undefined;
  const out: PluginTitlesMeta = { state };
  // Mal formée, une route facultative est ignorée seule : l'état reste valable.
  if (isSafePath(request)) out.request = request;
  if (isSafePath(access)) out.access = access;
  if (isSafePath(mine)) out.mine = mine;
  if (isSafePath(seasons)) out.seasons = seasons;
  return out;
}
