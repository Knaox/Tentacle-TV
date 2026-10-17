/**
 * Logique bandes-annonces partagée web / TV / mobile / serveur — fonctions
 * pures, zéro dépendance DOM. Source unique de vérité (les anciens modules
 * apps/web/src/components/detail/{trailerLang,mergeTrailers}.ts ré-exportent
 * depuis ici).
 *
 * MIROIR : le serveur choisit l'aperçu au survol (`/api/trailers/preview`)
 * avec CES règles — fusion, langue, type. Le fichier est recopié octet pour
 * octet dans `apps/backend/src/trailers/` (le backend ne dépend pas de
 * `@tentacle-tv/shared` — tsc CommonJS, image Docker sans packages/). On le
 * modifie ICI, puis :
 *
 *   cp packages/shared/src/trailers/trailerList.ts apps/backend/src/trailers/
 *
 * `trailersMirror.test.ts` (backend) refuse toute divergence. Aucun import.
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

/**
 * Ce qu'une vidéo est pour la langue visée : DOUBLÉE dans cette langue (une
 * VF), ORIGINALE SOUS-TITRÉE dans cette langue (une VOSTFR), ou autre chose.
 * « Français » = VF, puis VOSTFR, puis le reste.
 */
export type TrailerLangFit = "dubbed" | "subtitled" | "other";

/** Le libellé ramené à des mots : minuscules, sans accents, ponctuation → espaces (« V.O. » → « v o »). */
function nameWords(name: string | undefined): string {
  const plain = (name ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return ` ${plain.replace(/[^a-z0-9]+/g, " ").trim()} `;
}

/** Sous-titres FRANÇAIS : VOST, VOSTFR, « VO STFR », « sous-titré »… (AlloCiné, TMDB). */
const FRENCH_SUBTITLE_MARKS = / (vost|vostf|vostfr|vo st|vo stfr|v o st|v o st fr|v o stfr|stfr) |sous titr/;
/** Sous-titres sans langue dite : ceux de la langue de la vidéo. */
const SUBTITLE_MARKS = /subtitled|subbed/;
/** Version ORIGINALE : ni doublée, ni sous-titrée dite. */
const ORIGINAL_MARKS = / (vo|v o|version originale|original version) /;

/** Mots-clés d'une vraie version doublée (repli, faute de code langue). */
const LANG_KEYWORDS: Record<string, string[]> = {
  fr: ["vf", "vff", "vfq", "vfi", "version francaise", "francais", "french", "truefrench"],
  en: ["english", "official trailer", "us trailer", "uk trailer"],
};

/** Le libellé dit-il « sous-titré » (VOST, VOSTFR, VO STFR, subtitled…) ? */
export function hasSubtitleMark(name: string | undefined): boolean {
  const words = nameWords(name);
  return FRENCH_SUBTITLE_MARKS.test(words) || SUBTITLE_MARKS.test(words);
}

/**
 * La vidéo face à la langue `lang` (« fr », « fr-FR »). Le LIBELLÉ passe
 * avant le code ISO : TMDB étiquette `fr` des VOST et des VO (« Bande-annonce
 * VOST », « … VO »), le code n'est cru qu'à défaut de marque.
 */
export function trailerLangFit(tr: RichTrailer, lang: string | undefined): TrailerLangFit {
  const code = (lang ?? "").slice(0, 2).toLowerCase();
  if (!code) return "other";
  const words = nameWords(tr.Name);
  const tagged = tr.lang ? tr.lang.slice(0, 2).toLowerCase() : null;
  if (FRENCH_SUBTITLE_MARKS.test(words)) return code === "fr" ? "subtitled" : "other";
  if (SUBTITLE_MARKS.test(words)) return !tagged || tagged === code ? "subtitled" : "other";
  if (ORIGINAL_MARKS.test(words)) return "other";
  if (tagged) return tagged === code ? "dubbed" : "other";
  const keywords = LANG_KEYWORDS[code] ?? [];
  return keywords.some((k) => words.includes(` ${k} `)) ? "dubbed" : "other";
}

/** Le rang de langue d'une vidéo : 0 doublée, 1 sous-titrée, 2 autre. */
export function trailerLangRank(tr: RichTrailer, lang: string | undefined): number {
  const fit = trailerLangFit(tr, lang);
  return fit === "dubbed" ? 0 : fit === "subtitled" ? 1 : 2;
}

/** Une vraie version doublée dans la langue `lang` (une VF pour « fr ») — jamais une VOST ni une VO. */
export function trailerLangMatches(tr: RichTrailer, lang: string | undefined): boolean {
  return trailerLangFit(tr, lang) === "dubbed";
}

/**
 * Un bonus dit par son libellé — il l'emporte sur le type TMDB, que sa
 * communauté pose parfois de travers (une interview typée « Trailer ») :
 * featurette, coulisses, extrait, entretien, bêtisier, réaction, critique,
 * résumé, analyse, conférence de presse, fausse bande-annonce de fan…
 */
const EXTRA_NAME = new RegExp(
  " (featurettes?|behind the scenes?|making of|coulisses|interviews?|entretiens?|bloopers|gag reel|b roll|betisiers?|clips?|extraits?"
  + "|reactions?|react|reacts|review|reviews|critiques?|recap|resume|explained|explication|analyse|analysis|breakdown|easter eggs?"
  + "|q a|press conference|conference de presse|red carpet|tapis rouge|junket|commentary|commentaire|podcast|vlog|unboxing"
  + "|opening credits|generique|soundtrack|bande originale|music video|lyrics?|fan made|fanmade|concept trailer|parod(?:y|ie)|honest trailers?"
  + "|pitch meeting|scene coupee|scenes coupees|deleted scenes?) ",
);
const TRAILER_NAME = / (bande annonce|trailer) /;
const TEASER_NAME = / teaser /;

/** Le libellé sans les noms du titre : « The Interview - Official Trailer » n'est pas une interview. */
function wordsWithoutTitle(name: string | undefined, titleNames: readonly string[]): string {
  let words = nameWords(name);
  for (const title of titleNames) {
    const plain = nameWords(title).trim();
    if (plain) words = words.split(` ${plain} `).join(" ");
  }
  return words;
}

/**
 * Ce qu'est la vidéo : bande-annonce, teaser ou autre chose. Un mot de bonus
 * dans le libellé (hors noms du titre, `titleNames`) en fait TOUJOURS autre
 * chose, le mot « teaser » TOUJOURS un teaser ; sinon le type TMDB fait foi, sauf un « Clip » ou une « Featurette »
 * dont le libellé dit « bande-annonce » (TMDB type ainsi des VF) ; sans type
 * (Jellyfin), le libellé seul, et une vidéo sans mot-clé vaut bande-annonce.
 */
export function trailerKind(tr: RichTrailer, titleNames: readonly string[] = []): "trailer" | "teaser" | "other" {
  const words = wordsWithoutTitle(tr.Name, titleNames);
  if (EXTRA_NAME.test(words)) return "other";
  // Le libellé dit « teaser » : c'en est un, même typé « Trailer » (Barbie : « Teaser Officiel [VF] »).
  if (TEASER_NAME.test(words)) return "teaser";
  const type = (tr.type ?? "").toLowerCase();
  if (type === "trailer") return "trailer";
  if (type === "teaser") return "teaser";
  if (TRAILER_NAME.test(words)) return "trailer";
  return type ? "other" : "trailer";
}

/** Une bande-annonce « finale » vient après les numérotées. */
const FINAL_ORDINAL = 50;
const ORDINAL_RE = / (?:bande annonce|trailer|teaser)(?: officiel(?:le)?| official)?(?: n| no)? (\d{1,2}) /;

/**
 * Le rang d'une bande-annonce dans sa série : 1 pour la principale (« Official
 * Trailer », « Bande-annonce (1) »), 2 pour « Trailer 2 », « Bande-annonce
 * (2) VF », « Official Trailer #2 »… ; une « Final Trailer » après les
 * numérotées. Un numéro de SAISON (« Season 2 Trailer ») ne compte pas.
 */
export function trailerOrdinal(name: string | undefined): number {
  const words = nameWords(name);
  const match = ORDINAL_RE.exec(words);
  const value = match ? Number(match[1]) : 1;
  if (/ finale? (?:trailer|bande annonce) | (?:bande annonce|trailer) finale? /.test(words)) return Math.max(value, FINAL_ORDINAL);
  return value >= 1 && value <= 20 ? value : 1;
}

/** Priorité de type : un vrai trailer avant un teaser, puis le reste. */
function typeRank(tr: RichTrailer): number {
  const kind = trailerKind(tr);
  return kind === "trailer" ? 0 : kind === "teaser" ? 1 : 2;
}

/**
 * Trie les trailers. D'abord ce qui est dans la langue visée (doublée — la VF
 * —, ou sous-titrée — la VOSTFR), puis le reste ; dans chaque groupe, toutes
 * les bandes-annonces avant les teasers ; puis la VF avant la VOSTFR ; puis la
 * bande-annonce 1 avant la 2 (`trailerOrdinal`). Tri stable.
 */
export function sortTrailersByLang<T extends RichTrailer>(trailers: T[], lang: string | undefined): T[] {
  if (trailers.length < 2) return trailers;
  const group = (tr: RichTrailer) => (trailerLangRank(tr, lang) < 2 ? 0 : 1);
  return [...trailers].sort((a, b) =>
    group(a) - group(b)
    || typeRank(a) - typeRank(b)
    || trailerLangRank(a, lang) - trailerLangRank(b, lang)
    || trailerOrdinal(a.Name) - trailerOrdinal(b.Name));
}

/**
 * Fusionne les trailers Jellyfin (`RemoteTrailers`) et la liste complète TMDB
 * (via Jellyseerr) en dédupliquant par identifiant YouTube. Les entrées TMDB
 * priment (plus riches : type, langue). Ce qui n'est ni une bande-annonce ni
 * un teaser (interview, coulisses, extrait…) n'entre pas. Le résultat est
 * trié par `sortTrailersByLang`.
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

  return sortTrailersByLang([...byKey.values()].filter((tr) => trailerKind(tr) !== "other"), lang);
}
