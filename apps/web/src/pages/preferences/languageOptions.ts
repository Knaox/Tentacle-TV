/**
 * Les langues proposées par Réglages › Langues et sous-titres : pistes audio
 * et sous-titres des bibliothèques (codes ISO 639-2 de Jellyfin, plus les
 * variantes VFF / VFQ), et la langue de l'interface.
 */

export const LANGUAGE_CODES = [
  "fre", "fre-vff", "fre-vfq", "eng", "jpn", "ger", "spa", "ita", "por", "rus", "kor", "chi",
  "ara", "pol", "dut", "cze", "hin", "tha", "swe", "nor", "fin", "tur",
  "hun", "rum", "gre", "dan", "heb", "vie", "ind", "may", "ukr", "bul",
  "hrv", "srp", "cat", "tam", "tel", "per",
] as const;

export const LANGUAGE_KEYS: Record<string, string> = {
  fre: "preferences:langFr",
  "fre-vff": "preferences:langFrVff",
  "fre-vfq": "preferences:langFrVfq",
  eng: "preferences:langEn",
  jpn: "preferences:langJa",
  ger: "preferences:langDe",
  spa: "preferences:langEs",
  ita: "preferences:langIt",
  por: "preferences:langPt",
  rus: "preferences:langRu",
  kor: "preferences:langKo",
  chi: "preferences:langZh",
  ara: "preferences:langAr",
  pol: "preferences:langPl",
  dut: "preferences:langNl",
  cze: "preferences:langCs",
  hin: "preferences:langHi",
  tha: "preferences:langTh",
  swe: "preferences:langSv",
  nor: "preferences:langNo",
  fin: "preferences:langFi",
  tur: "preferences:langTr",
  hun: "preferences:langHu",
  rum: "preferences:langRo",
  gre: "preferences:langEl",
  dan: "preferences:langDa",
  heb: "preferences:langHe",
  vie: "preferences:langVi",
  ind: "preferences:langId",
  may: "preferences:langMs",
  ukr: "preferences:langUk",
  bul: "preferences:langBg",
  hrv: "preferences:langHr",
  srp: "preferences:langSr",
  cat: "preferences:langCa",
  tam: "preferences:langTa",
  tel: "preferences:langTe",
  per: "preferences:langFa",
};

export const INTERFACE_LANGUAGES = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
] as const;
