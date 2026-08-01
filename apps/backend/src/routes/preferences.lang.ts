/**
 * Appariement des langues de pistes — alias ISO, variantes régionales, pistes
 * forcées.
 *
 * Extrait de `preferences.ts` (limite de 300 lignes par fichier) avec la
 * résolution qui s'en sert, `preferences.resolve.ts`. Aucun changement de
 * comportement : les tables et les fonctions sont reprises telles quelles.
 *
 * Jellyfin est incohérent dans ses codes de langue — parfois ISO 639-1, parfois
 * 639-2/B ou /T, parfois le nom affiché, parfois rien du tout. D'où ces groupes
 * d'alias, et le repli sur le TITRE de la piste quand le champ de langue est vide.
 */

// ISO 639-1 (2 lettres), ISO 639-2/B et /T (3 lettres), noms affichés.
const LANG_GROUPS: string[][] = [
  ["fr", "fre", "fra", "french", "français", "francais"],
  ["en", "eng", "english"],
  ["ja", "jp", "jpn", "jap", "japanese", "japonais"],
  ["de", "ger", "deu", "german", "allemand"],
  ["es", "spa", "spanish", "espagnol"],
  ["it", "ita", "italian", "italien"],
  ["pt", "por", "portuguese", "portugais"],
  ["ru", "rus", "russian", "russe"],
  ["ko", "kor", "korean", "coréen"],
  ["zh", "chi", "zho", "chinese", "chinois"],
  ["ar", "ara", "arabic", "arabe"],
  ["pl", "pol", "polish", "polonais"],
  ["nl", "dut", "nld", "dutch", "néerlandais"],
  ["cs", "cze", "ces", "czech", "tchèque"],
  ["hi", "hin", "hindi"],
  ["th", "tha", "thai"],
  ["sv", "swe", "swedish", "suédois"],
  ["no", "nor", "nob", "nno", "norwegian", "norvégien"],
  ["fi", "fin", "finnish", "finnois"],
  ["tr", "tur", "turkish", "turc"],
  ["hu", "hun", "hungarian", "hongrois"],
  ["ro", "ron", "rum", "romanian", "roumain"],
  ["el", "gre", "ell", "greek", "grec"],
  ["da", "dan", "danish", "danois"],
  ["he", "heb", "hebrew", "hébreu"],
  ["vi", "vie", "vietnamese", "vietnamien"],
  ["id", "ind", "indonesian", "indonésien"],
  ["ms", "may", "msa", "malay", "malais"],
  ["uk", "ukr", "ukrainian", "ukrainien"],
  ["bg", "bul", "bulgarian", "bulgare"],
  ["hr", "hrv", "croatian", "croate"],
  ["sr", "srp", "scc", "serbian", "serbe"],
  ["ca", "cat", "catalan"],
  ["ta", "tam", "tamil", "tamoul"],
  ["te", "tel", "telugu", "télougou"],
  ["fa", "per", "fas", "persian", "persan"],
  ["sk", "slo", "slk", "slovak", "slovaque"],
  ["sl", "slv", "slovenian", "slovène"],
  ["lt", "lit", "lithuanian", "lituanien"],
  ["lv", "lav", "latvian", "letton"],
  ["et", "est", "estonian", "estonien"],
  ["ml", "mal", "malayalam"],
  ["bn", "ben", "bengali"],
  ["ur", "urd", "urdu"],
  ["tl", "fil", "tagalog", "filipino"],
];

export const ALIAS_MAP = new Map<string, Set<string>>();
for (const group of LANG_GROUPS) {
  const s = new Set(group);
  for (const code of group) ALIAS_MAP.set(code, s);
}

export function langMatches(trackLang: string | undefined, prefLang: string): boolean {
  if (!trackLang) return false;
  const tl = trackLang.toLowerCase();
  const pl = prefLang.toLowerCase();
  if (tl === pl) return true;
  const group = ALIAS_MAP.get(pl);
  return group?.has(tl) ?? false;
}

/** Découpe un code de langue à variante : "fre-vff" → ["fre", "vff"], "jpn" → ["jpn", null]. */
export function parseVariant(code: string): [string, string | null] {
  const idx = code.indexOf("-");
  if (idx < 0) return [code, null];
  return [code.substring(0, idx), code.substring(idx + 1)];
}

/**
 * Motifs de variantes : les titres de pistes Jellyfin peuvent porter le nom
 * complet (« Français (France) ») là où l'on attend l'étiquette (« VFF »).
 */
const VARIANT_ALIASES: Record<string, string[]> = {
  vff: ["vff", "france", "français (france)", "french (france)", "vf "],
  vfq: ["vfq", "québec", "quebec", "québécois", "quebecois", "canada", "canadien", "français (canada)", "french (canada)"],
  vfi: ["vfi", "international"],
  vf: ["vf"],
};

export function variantMatchesTitle(title: string | undefined, variant: string): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  const aliases = VARIANT_ALIASES[variant.toLowerCase()];
  if (aliases) return aliases.some((alias) => lower.includes(alias));
  return lower.includes(variant.toLowerCase());
}

/** `IsForced` est parfois absent des MediaStreams → heuristique sur le titre. */
export function isForcedTrack(t: { isForced?: boolean; title?: string }): boolean {
  return !!t.isForced || /\bforc(ed|é)e?s?\b/i.test(t.title ?? "");
}
