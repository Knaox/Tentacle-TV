/**
 * Les langues proposées, et les modes de sous-titres.
 *
 * Repris tel quel de `apps/web/src/pages/Preferences.tsx` — mêmes codes, mêmes
 * clés de traduction, même ordre. Ce n'est pas une liste qu'on refait : le
 * backend range ces valeurs telles quelles dans `library_preferences`, et une
 * divergence de code entre deux clients ferait que la préférence posée sur l'un
 * ne serait plus reconnue par l'autre.
 *
 * **En ISO 639-2/B, comme le web.** `apps/tv` envoie de l'ISO 639-1 (`fr`,
 * `en`) ; le backend absorbe les deux par son `ALIAS_MAP`, mais l'affichage du
 * client web cherche ses libellés par code exact et ne retrouverait pas un
 * `fr`. On reste donc sur la convention du web, dont on réemploie les écrans.
 */

export const LANGUAGE_CODES = [
  "fre", "fre-vff", "fre-vfq", "eng", "jpn", "ger", "spa", "ita", "por", "rus", "kor", "chi",
  "ara", "pol", "dut", "cze", "hin", "tha", "swe", "nor", "fin", "tur",
  "hun", "rum", "gre", "dan", "heb", "vie", "ind", "may", "ukr", "bul",
  "hrv", "srp", "cat", "tam", "tel", "per",
] as const;

export const LANGUAGE_KEYS: Record<string, string> = {
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
export const SUBTITLE_MODES = [
  { value: "none", key: "modeDisabled" },
  { value: "always", key: "modeAlwaysOn" },
  { value: "forced", key: "modeForcedOnly" },
  { value: "signs", key: "modeSignsSongs" },
] as const;

/** Les deux langues d'interface traduites. Codes courts : c'est i18next ici. */
export const INTERFACE_LANGUAGES = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
] as const;
