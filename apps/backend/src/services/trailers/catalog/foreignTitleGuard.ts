/* ------------------------------------------------------------------ */
/*  Jamais la bande-annonce d'un AUTRE titre — pur                      */
/*                                                                     */
/*  Les listes de TMDB sont tenues par sa communauté, et se trompent :  */
/*  la saison 4 de Rick et Morty y porte « Narcos Mexico: L' Agent Kiki */
/*  Camarena | Bande-annonce VOSTFR | Netflix » (relevé le 2026-10-14). */
/*  Une vidéo dont le libellé est découpé en morceaux (« | », « - »,   */
/*  « : ») et dont le PREMIER morceau nomme quelque chose — ni le titre,*/
/*  ni des mots de bande-annonce (« Official Trailer », « Saison 4 ») — */
/*  est celle d'un autre titre : écartée. Un libellé générique sans      */
/*  découpe (« Season 7 Coming to Max Jan 22 ») reste : rien n'y dit un */
/*  autre titre. Dans le doute, la vidéo reste — c'est le libellé qui   */
/*  doit la trahir.                                                     */
/* ------------------------------------------------------------------ */

import { normalizeShowName } from "../allocine/allocineMatch";

/** Les mots d'un libellé de bande-annonce qui ne nomment aucun titre. */
const GENERIC_WORDS = new Set([
  "official", "officielle", "officiel", "trailer", "trailers", "teaser", "teasers", "promo", "promos", "bande", "annonce",
  "season", "saison", "seasons", "saisons", "episode", "part", "partie", "final", "finale", "new", "nouvelle", "nouveau",
  "extended", "sneak", "peek", "clip", "vf", "vff", "vfq", "vost", "vostfr", "vo", "stfr", "fr", "en", "us", "uk", "hd", "4k",
  "the", "le", "la", "les", "de", "du", "des", "of", "et", "and", "a", "un", "une",
]);

/** Le libellé ramené à des mots comparables : `&` = `and` = `et`. */
function words(text: string): string {
  return ` ${normalizeShowName(text).replace(/\band\b/g, "et")} `;
}

/** Le morceau ne contient que des mots de bande-annonce et des nombres. */
function isGeneric(segment: string): boolean {
  return words(segment).trim().split(" ").every((word) => word === "" || /^\d+$/.test(word) || GENERIC_WORDS.has(word));
}

/**
 * Le libellé `name` est-il celui d'un AUTRE titre que `titleNames` (nom dans
 * la langue du serveur, original, alternatifs) ? `false` dans le doute.
 */
export function namesAnotherTitle(name: string | undefined, titleNames: readonly string[]): boolean {
  if (!name) return false;
  const known = titleNames.map((title) => words(title).trim()).filter(Boolean);
  if (known.length === 0) return false;
  const label = words(name);
  if (known.some((title) => label.includes(` ${title} `))) return false;
  const segments = name.split(/\s+[|–—-]\s+|\s*\|\s*|:\s+/).map((segment) => segment.trim()).filter(Boolean);
  if (segments.length < 2) return false;
  return !isGeneric(segments[0]);
}

/** Ce que le catalogue sait de l'identité du titre : son année, ses pays d'origine (codes ISO, `US`). */
export interface TitleIdentity {
  year?: number | null;
  countries?: readonly string[];
}

/** Les pays qu'un libellé accole au nom d'un titre pour dire SA version (« The Office (UK) »). */
const COUNTRY_ALIASES: Record<string, string> = { uk: "GB", gb: "GB", us: "US", usa: "US", au: "AU", nz: "NZ", ca: "CA", fr: "FR", de: "DE", es: "ES", it: "IT", jp: "JP", kr: "KR", in: "IN" };
/** Sans parenthèses, seuls ces pays-là disent une version — « fr » ou « en » y diraient une langue. */
const BARE_COUNTRIES = new Set(["uk", "us", "usa", "au", "nz"]);

/** Le libellé en mots, parenthèses et crochets gardés comme des mots à part. */
function markedWords(text: string): string[] {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, " et ")
    .replace(/[([]/g, " ( ").replace(/[)\]]/g, " ) ").replace(/[^a-z0-9()]+/g, " ").trim().split(" ").filter(Boolean)
    .map((word) => (word === "and" ? "et" : word));
}

/**
 * Le libellé `name` est-il celui d'une AUTRE VERSION du titre — un homonyme
 * qui porte le même nom ? Juste après le nom du titre, un pays (« The Office
 * (UK) », « The Office UK ») qui n'est pas l'un des siens, ou une année entre
 * parenthèses à plus d'un an de la sienne (« Dune (1984) »). Un pays qu'on ne
 * peut pas vérifier (pays du titre inconnus) écarte aussi : mieux vaut aucune
 * bande-annonce que celle d'une autre série (relevé du testeur, 17/10 : la
 * seule vidéo de The Office US était celle de la version anglaise).
 */
export function namesAnotherVariant(name: string | undefined, titleNames: readonly string[], identity: TitleIdentity = {}): boolean {
  if (!name) return false;
  const label = markedWords(name);
  const countries = new Set((identity.countries ?? []).map((code) => code.toUpperCase()));
  for (const title of titleNames) {
    const own = markedWords(title).filter((word) => word !== "(" && word !== ")");
    if (own.length === 0) continue;
    for (let i = 0; i + own.length <= label.length; i++) {
      if (!own.every((word, k) => label[i + k] === word)) continue;
      let next = i + own.length;
      const parenthesized = label[next] === "(";
      if (parenthesized) next++;
      const mark = label[next];
      if (!mark || (parenthesized && label[next + 1] !== ")")) continue;
      // Le nom du titre porte lui-même la marque (« The Office (US) » dans la bibliothèque) : c'est le sien.
      if (titleNames.some((other) => ` ${markedWords(other).join(" ")} `.includes(` ${[...own, ...(parenthesized ? ["("] : []), mark].join(" ")} `))) continue;
      const country = COUNTRY_ALIASES[mark];
      if (country && (parenthesized || BARE_COUNTRIES.has(mark)) && !countries.has(country)) return true;
      if (parenthesized && /^(19|20)\d{2}$/.test(mark) && identity.year && Math.abs(Number(mark) - identity.year) > 1) return true;
    }
  }
  return false;
}
