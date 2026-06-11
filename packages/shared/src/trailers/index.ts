/**
 * Logique bandes-annonces partagée web / TV / mobile — fonctions pures, zéro
 * dépendance DOM. Source unique de vérité (les anciens modules
 * apps/web/src/components/detail/{trailerLang,mergeTrailers}.ts ré-exportent
 * depuis ici).
 */

export interface RichTrailer {
  Url: string;
  Name?: string;
  /** Type TMDB : Trailer | Teaser | Clip | Featurette… (absent côté Jellyfin). */
  type?: string;
  /** Code langue ISO 639-1 si fourni par TMDB/Jellyseerr (ex: "fr"). */
  lang?: string;
}

export interface JellyfinTrailer {
  Url: string;
  Name?: string;
}

/** Vidéo TMDB renvoyée par la route backend /api/tmdb/trailers. */
export interface TmdbVideo {
  key: string;
  name?: string;
  type?: string;
  site?: string;
  lang?: string;
  url: string;
}

/**
 * Extrait l'identifiant vidéo YouTube d'une URL de trailer distant.
 * Gère : `watch?v=`, `youtu.be/`, `embed/`, `v/`, `shorts/`, et le format
 * déprécié NFO `plugin://plugin.video.youtube/play/?video_id=ID`.
 * Retourne `null` si l'URL n'est pas une URL YouTube reconnue.
 */
export function parseYouTubeId(url: string | undefined): string | null {
  if (!url) return null;

  const pluginMatch = url.match(/[?&]video_id=([\w-]{11})/);
  if (pluginMatch) return pluginMatch[1];

  const patterns = [
    /youtube\.com\/watch\?(?:.*&)?v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/v\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

/** Mots-clés indiquant une vraie version doublée (signal `Name`, repli sans code langue). */
const LANG_KEYWORDS: Record<string, string[]> = {
  fr: ["vf", "vff", "vfq", "version française", "version francaise", "français", "francais", "french", "truefrench"],
  en: ["english", "(en)", "official trailer", "us trailer", "uk trailer"],
};

/** Un VOSTFR est une version ORIGINALE sous-titrée, PAS une VF. */
const SUBBED_MARKERS = ["vost", "sous-titr", "subtitled", "vostfr"];

function langMatches(tr: RichTrailer, code: string): boolean {
  // Signal fiable : code langue ISO fourni par TMDB.
  if (tr.lang) return tr.lang.slice(0, 2).toLowerCase() === code;
  // Repli heuristique sur le libellé.
  const n = (tr.Name ?? "").toLowerCase();
  if (code === "fr" && SUBBED_MARKERS.some((m) => n.includes(m))) return false;
  const kws = LANG_KEYWORDS[code];
  return kws ? kws.some((k) => n.includes(k)) : false;
}

/** Priorité de type : un vrai trailer avant un teaser, puis le reste. */
function typeRank(type?: string): number {
  const t = (type ?? "").toLowerCase();
  if (t === "" || t === "trailer") return 0;
  if (t === "teaser") return 1;
  return 2;
}

/**
 * Trie les trailers pour faire remonter la langue de l'utilisateur (VF fiable via
 * code ISO si présent, sinon heuristique), puis les trailers avant les teasers.
 * Tri stable.
 */
export function sortTrailersByLang<T extends RichTrailer>(trailers: T[], lang: string | undefined): T[] {
  const code = (lang ?? "").slice(0, 2);
  if (trailers.length < 2) return trailers;
  return [...trailers].sort((a, b) => {
    const la = langMatches(a, code) ? 0 : 1;
    const lb = langMatches(b, code) ? 0 : 1;
    if (la !== lb) return la - lb;
    return typeRank(a.type) - typeRank(b.type);
  });
}

/**
 * Fusionne les trailers Jellyfin (`RemoteTrailers`) et la liste complète TMDB
 * (via Jellyseerr) en dédupliquant par identifiant YouTube. Les entrées TMDB
 * priment (plus riches : type, langue). Le résultat est trié par langue de
 * l'utilisateur puis par type (trailer avant teaser).
 */
export function mergeTrailers(
  jellyfin: JellyfinTrailer[],
  tmdb: TmdbVideo[],
  lang: string | undefined,
): RichTrailer[] {
  const byKey = new Map<string, RichTrailer>();
  const keyOf = (url: string) => parseYouTubeId(url) ?? url;

  for (const j of jellyfin) {
    if (!j.Url) continue;
    const id = keyOf(j.Url);
    if (!byKey.has(id)) byKey.set(id, { Url: j.Url, Name: j.Name });
  }
  for (const v of tmdb) {
    if (!v.url) continue;
    const id = v.key || keyOf(v.url);
    byKey.set(id, { Url: v.url, Name: v.name, type: v.type, lang: v.lang });
  }

  return sortTrailersByLang([...byKey.values()], lang);
}
