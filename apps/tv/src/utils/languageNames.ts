/**
 * Maps ISO 639-1/2/3 language codes to human-readable display names.
 * Covers all common codes returned by Jellyfin media streams.
 */

const LANGUAGE_MAP: Record<string, string> = {
  // ISO 639-1 (2-letter) — readable Latin names
  fr: "Français",
  en: "English",
  ja: "Japonais",
  de: "Allemand",
  es: "Espagnol",
  it: "Italien",
  pt: "Portugais",
  ru: "Russe",
  ko: "Coréen",
  zh: "Chinois",
  ar: "Arabe",
  pl: "Polonais",
  nl: "Néerlandais",
  cs: "Tchèque",
  hi: "Hindi",
  th: "Thaï",
  sv: "Suédois",
  no: "Norvégien",
  fi: "Finnois",
  tr: "Turc",
  hu: "Hongrois",
  ro: "Roumain",
  el: "Grec",
  da: "Danois",
  he: "Hébreu",
  vi: "Vietnamien",
  id: "Indonésien",
  ms: "Malais",
  uk: "Ukrainien",
  bg: "Bulgare",
  hr: "Croate",
  sr: "Serbe",
  ca: "Catalan",
  ta: "Tamoul",
  te: "Télougou",
  fa: "Persan",
  nb: "Norvégien Bokmål",
  nn: "Nynorsk",

  // ISO 639-2/3 (3-letter) — Jellyfin often returns these
  fre: "Français",
  fra: "Français",
  eng: "English",
  jpn: "Japonais",
  ger: "Allemand",
  deu: "Allemand",
  spa: "Espagnol",
  ita: "Italien",
  por: "Portugais",
  rus: "Russe",
  kor: "Coréen",
  chi: "Chinois",
  zho: "Chinois",
  ara: "Arabe",
  pol: "Polonais",
  dut: "Néerlandais",
  nld: "Néerlandais",
  cze: "Tchèque",
  ces: "Tchèque",
  hin: "Hindi",
  tha: "Thaï",
  swe: "Suédois",
  nor: "Norvégien",
  nob: "Norvégien Bokmål",
  nno: "Nynorsk",
  fin: "Finnois",
  tur: "Turc",
  hun: "Hongrois",
  rum: "Roumain",
  ron: "Roumain",
  gre: "Grec",
  ell: "Grec",
  dan: "Danois",
  heb: "Hébreu",
  vie: "Vietnamien",
  ind: "Indonésien",
  may: "Malais",
  msa: "Malais",
  ukr: "Ukrainien",
  bul: "Bulgare",
  hrv: "Croate",
  srp: "Serbe",
  cat: "Catalan",
  tam: "Tamoul",
  tel: "Télougou",
  per: "Persan",
  fas: "Persan",
  lat: "Latin",
  und: "Inconnu",
  mul: "Multiple",
  mis: "Autre",
};

/**
 * Convert an ISO language code to a human-readable display name.
 * Returns the original code if no mapping is found.
 */
export function getLanguageDisplayName(code: string | null | undefined): string {
  if (!code) return "";
  const lower = code.toLowerCase().trim();
  return LANGUAGE_MAP[lower] ?? code;
}

/**
 * Format a track label with readable language name.
 * Example: "fre" → "Français", "eng (AAC 5.1)" → "English (AAC 5.1)"
 */
export function formatTrackLanguage(
  language: string | null | undefined,
  codec?: string | null,
  channels?: number | null,
): string {
  const langName = getLanguageDisplayName(language);
  const parts: string[] = [langName || "Unknown"];
  if (codec) parts.push(codec.toUpperCase());
  if (channels) {
    if (channels === 8) parts.push("7.1");
    else if (channels === 6) parts.push("5.1");
    else if (channels === 2) parts.push("Stereo");
    else if (channels === 1) parts.push("Mono");
    else parts.push(`${channels}ch`);
  }
  return parts.join(" · ");
}
