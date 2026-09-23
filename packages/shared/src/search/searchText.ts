/**
 * Le texte de la recherche Tentacle — UNE forme, lue par le moteur du serveur
 * (index et requête) ET par les clients (surlignage, complétion en ligne). Un
 * surlignage qui ne plierait pas comme l'index soulignerait autre chose que ce
 * qui a été trouvé.
 *
 * On part de `normalizeSearch` (accents, casse, ponctuation — voir son en-tête
 * pour ce que Jellyfin fait de la ponctuation) et on y ajoute ce qu'un moteur
 * tolérant exige :
 *
 * - les ligatures que NFD ne décompose pas : « L'Œil du tigre » se trouve par
 *   « oeil » ;
 * - des VARIANTES de titre, indexées à côté du titre : les mots soudés
 *   (« Spider-Man » → « spiderman », « WALL·E » → « walle ») et les chiffres
 *   romains dans les deux sens (« Rocky II » ↔ « rocky 2 ») ;
 * - une requête LUE : les mots vides ne sont exigés que s'ils sont seuls
 *   (« the office » cherche « office », mais « It » reste trouvable), une
 *   année devient un indice de classement (« dune 2021 »), et « film »,
 *   « série », « saga » deviennent un indice de type.
 *
 * ⚠️ Aucune classe Unicode (`\p{L}`) : ce module tourne aussi sous Hermes.
 *
 * Recopié octet pour octet dans le backend (`apps/backend/src/search/`, avec
 * `utils/textSearch.ts`), tenu par `searchMirror.test.ts` : le serveur plie
 * EXACTEMENT comme les clients surlignent. On modifie ICI, on recopie là-bas.
 */

import { normalizeSearch } from "../utils/textSearch";

/** Ligatures et lettres que la décomposition NFD laisse entières. */
const LIGATURES: ReadonlyArray<readonly [RegExp, string]> = [
  [/[œŒ]/g, "oe"],
  [/[æÆ]/g, "ae"],
  [/ß/g, "ss"],
  [/[øØ]/g, "o"],
  [/[đĐ]/g, "d"],
  [/[łŁ]/g, "l"],
  [/ı/g, "i"],
];

/** Ce que `normalizeSearch` ne range pas parmi ses séparateurs. */
const EXTRA_SEPARATORS = /[…¡¿®™©°•†‡§¶]/g;

/** Forme pliée d'un texte : la base commune de l'index et de la requête. */
export function foldForSearch(value: string): string {
  let folded = value.replace(EXTRA_SEPARATORS, " ");
  for (const [pattern, replacement] of LIGATURES) folded = folded.replace(pattern, replacement);
  return normalizeSearch(folded);
}

/** Les mots pliés d'un texte. */
export function searchTokens(value: string): string[] {
  const folded = foldForSearch(value);
  return folded === "" ? [] : folded.split(" ");
}

/**
 * Chiffres romains ↔ arabes, sans les lettres seules : « V pour Vendetta »,
 * « Malcolm X » et « I, Robot » ne sont pas des numéros.
 */
const ROMAN_TO_ARABIC: Readonly<Record<string, string>> = {
  ii: "2", iii: "3", iv: "4", vi: "6", vii: "7", viii: "8", ix: "9",
  xi: "11", xii: "12", xiii: "13", xiv: "14", xv: "15", xvi: "16",
  xvii: "17", xviii: "18", xix: "19", xx: "20",
};
const ARABIC_TO_ROMAN: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(ROMAN_TO_ARABIC).map(([roman, arabic]) => [arabic, roman]),
);

/**
 * Les variantes d'un titre, indexées À CÔTÉ de ses mots : paires soudées et
 * numéros dans l'autre écriture. Jamais les mots eux-mêmes (déjà indexés), et
 * jamais une paire avec un mot vide : « Potter à l'école » soudé en
 * « pottera » ne serait qu'un mot fantôme de plus, qui remonterait dans les
 * suggestions d'orthographe.
 */
export function titleVariants(tokens: readonly string[]): string[] {
  const variants = new Set<string>();
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const next = tokens[i + 1];
    if (next !== undefined && !STOP_WORDS.has(token) && !STOP_WORDS.has(next)) variants.add(token + next);
    const numeral = ROMAN_TO_ARABIC[token] ?? ARABIC_TO_ROMAN[token];
    if (numeral !== undefined) variants.add(numeral);
  }
  for (const token of tokens) variants.delete(token);
  return [...variants];
}

/** Mots vides, français et anglais — exigés seulement quand ils sont seuls. */
const STOP_WORDS: ReadonlySet<string> = new Set([
  "the", "a", "an", "of", "and", "or", "in", "on", "to", "at", "for", "with", "from", "by",
  "le", "la", "les", "l", "un", "une", "des", "de", "du", "d", "et", "ou", "en", "au", "aux",
  "sur", "pour", "par", "dans", "avec", "sans", "chez",
]);

export type SearchTypeHint = "Movie" | "Series" | "BoxSet";

/** Les mots qui désignent un TYPE plutôt qu'un titre — « film avec Tom Hanks ». */
const TYPE_WORDS: Readonly<Record<string, SearchTypeHint>> = {
  film: "Movie", films: "Movie", movie: "Movie", movies: "Movie",
  serie: "Series", series: "Series", show: "Series", shows: "Series",
  saga: "BoxSet", sagas: "BoxSet", collection: "BoxSet", collections: "BoxSet", coffret: "BoxSet",
};

export interface ParsedSearchQuery {
  /** Ce qui a été tapé. */
  raw: string;
  /** La requête pliée entière — pour comparer à un titre plié. */
  folded: string;
  /** Les termes exigés, dans l'ordre de la saisie. */
  terms: string[];
  /** Une année citée à côté d'autres mots : un indice, jamais un filtre. */
  year: number | null;
  /** « film », « série », « saga »… : un indice de type, jamais un filtre. */
  type: SearchTypeHint | null;
}

function isYear(token: string): boolean {
  if (!/^\d{4}$/.test(token)) return false;
  const year = Number(token);
  return year >= 1900 && year <= 2099;
}

/**
 * Lit une requête. Ce qui n'est qu'indice (mot vide, type, année) n'est retiré
 * que s'il reste un vrai terme : « It », « 1917 », « Film » restent cherchables.
 */
export function parseSearchQuery(raw: string): ParsedSearchQuery {
  const tokens = searchTokens(raw);
  const significant = tokens.filter((t) => !STOP_WORDS.has(t) && TYPE_WORDS[t] === undefined && !isYear(t));
  if (significant.length === 0) {
    return { raw, folded: tokens.join(" "), terms: tokens, year: null, type: null };
  }
  const yearToken = [...tokens].reverse().find(isYear);
  const typeToken = tokens.find((t) => TYPE_WORDS[t] !== undefined);
  return {
    raw,
    folded: tokens.join(" "),
    terms: significant,
    year: yearToken === undefined ? null : Number(yearToken),
    type: typeToken === undefined ? null : (TYPE_WORDS[typeToken] ?? null),
  };
}
