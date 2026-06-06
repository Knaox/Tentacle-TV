export interface RichTrailer {
  Url: string;
  Name?: string;
  /** Type TMDB : Trailer | Teaser | Clip | Featurette… (absent côté Jellyfin). */
  type?: string;
  /** Code langue ISO 639-1 si fourni par TMDB/Jellyseerr (ex: "fr"). */
  lang?: string;
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
