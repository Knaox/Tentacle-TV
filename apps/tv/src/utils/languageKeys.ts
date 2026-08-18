/**
 * Les langues proposées et les modes de sous-titres — port de
 * `languagesTv.ts` (webOS), lui-même repris de `apps/web/src/pages/Preferences.tsx`.
 *
 * Ce n'est pas une liste qu'on refait : le backend range ces valeurs telles
 * quelles dans `library_preferences`, et une divergence de code entre deux
 * clients ferait qu'une préférence posée sur l'un ne serait plus reconnue par
 * l'autre. **En ISO 639-2/B, comme le web** — l'ancienne liste locale de
 * l'app TV (20 codes) disparaît avec `PreferencesScreen`.
 */

export const CODES_LANGUE = [
  "fre", "fre-vff", "fre-vfq", "eng", "jpn", "ger", "spa", "ita", "por", "rus", "kor", "chi",
  "ara", "pol", "dut", "cze", "hin", "tha", "swe", "nor", "fin", "tur",
  "hun", "rum", "gre", "dan", "heb", "vie", "ind", "may", "ukr", "bul",
  "hrv", "srp", "cat", "tam", "tel", "per",
] as const;

/** Code → clé du namespace `preferences` (les 38 existent en FR et EN). */
export const CLES_LANGUE: Record<string, string> = {
  fre: "langFr",
  "fre-vff": "langFrVff",
  "fre-vfq": "langFrVfq",
  eng: "langEn",
  jpn: "langJa",
  ger: "langDe",
  spa: "langEs",
  ita: "langIt",
  por: "langPt",
  rus: "langRu",
  kor: "langKo",
  chi: "langZh",
  ara: "langAr",
  pol: "langPl",
  dut: "langNl",
  cze: "langCs",
  hin: "langHi",
  tha: "langTh",
  swe: "langSv",
  nor: "langNo",
  fin: "langFi",
  tur: "langTr",
  hun: "langHu",
  rum: "langRo",
  gre: "langEl",
  dan: "langDa",
  heb: "langHe",
  vie: "langVi",
  ind: "langId",
  may: "langMs",
  ukr: "langUk",
  bul: "langBg",
  hrv: "langHr",
  srp: "langSr",
  cat: "langCa",
  tam: "langTa",
  tel: "langTe",
  per: "langFa",
};

/** Les quatre modes de sous-titres, et la clé qui les nomme. */
export const MODES_SOUS_TITRES = [
  { valeur: "none", cle: "modeDisabled" },
  { valeur: "always", cle: "modeAlwaysOn" },
  { valeur: "forced", cle: "modeForcedOnly" },
  { valeur: "signs", cle: "modeSignsSongs" },
] as const;

/** Les deux langues d'interface traduites. Codes courts : c'est i18next ici. */
export const LANGUES_INTERFACE = [
  { code: "fr", libelle: "Français" },
  { code: "en", libelle: "English" },
] as const;
