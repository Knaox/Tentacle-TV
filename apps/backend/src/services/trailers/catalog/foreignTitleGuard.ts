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
