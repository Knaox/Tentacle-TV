/**
 * Maps ISO 639-1/2/3 language codes to human-readable display names.
 * Covers all common codes returned by Jellyfin media streams.
 */

const LANGUAGE_MAP: Record<string, string> = {
  // ISO 639-1 (2-letter)
  fr: "Français",
  en: "English",
  ja: "日本語",
  de: "Deutsch",
  es: "Español",
  it: "Italiano",
  pt: "Português",
  ru: "Русский",
  ko: "한국어",
  zh: "中文",
  ar: "العربية",
  pl: "Polski",
  nl: "Nederlands",
  cs: "Čeština",
  hi: "हिन्दी",
  th: "ไทย",
  sv: "Svenska",
  no: "Norsk",
  fi: "Suomi",
  tr: "Türkçe",
  hu: "Magyar",
  ro: "Română",
  el: "Ελληνικά",
  da: "Dansk",
  he: "עברית",
  vi: "Tiếng Việt",
  id: "Bahasa Indonesia",
  ms: "Bahasa Melayu",
  uk: "Українська",
  bg: "Български",
  hr: "Hrvatski",
  sr: "Srpski",
  ca: "Català",
  ta: "தமிழ்",
  te: "తెలుగు",
  fa: "فارسی",
  nb: "Norsk Bokmål",
  nn: "Nynorsk",

  // ISO 639-2/3 (3-letter) — Jellyfin often returns these
  fre: "Français",
  fra: "Français",
  eng: "English",
  jpn: "日本語",
  ger: "Deutsch",
  deu: "Deutsch",
  spa: "Español",
  ita: "Italiano",
  por: "Português",
  rus: "Русский",
  kor: "한국어",
  chi: "中文",
  zho: "中文",
  ara: "العربية",
  pol: "Polski",
  dut: "Nederlands",
  nld: "Nederlands",
  cze: "Čeština",
  ces: "Čeština",
  hin: "हिन्दी",
  tha: "ไทย",
  swe: "Svenska",
  nor: "Norsk",
  nob: "Norsk Bokmål",
  nno: "Nynorsk",
  fin: "Suomi",
  tur: "Türkçe",
  hun: "Magyar",
  rum: "Română",
  ron: "Română",
  gre: "Ελληνικά",
  ell: "Ελληνικά",
  dan: "Dansk",
  heb: "עברית",
  vie: "Tiếng Việt",
  ind: "Bahasa Indonesia",
  may: "Bahasa Melayu",
  msa: "Bahasa Melayu",
  ukr: "Українська",
  bul: "Български",
  hrv: "Hrvatski",
  srp: "Srpski",
  cat: "Català",
  tam: "தமிழ்",
  tel: "తెలుగు",
  per: "فارسی",
  fas: "فارسی",
  lat: "Latina",
  und: "Unknown",
  mul: "Multiple",
  mis: "Other",
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
