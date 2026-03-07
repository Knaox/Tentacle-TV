import type { MediaStream as JfStream } from "@tentacle-tv/shared";

/** Hermes doesn't have crypto.randomUUID — simple v4 UUID fallback */
export function randomUUID(): string {
  const hex = "0123456789abcdef";
  let id = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) { id += "-"; continue; }
    if (i === 14) { id += "4"; continue; }
    const r = (Math.random() * 16) | 0;
    id += hex[i === 19 ? (r & 0x3) | 0x8 : r];
  }
  return id;
}

export function formatTrackLabel(s: JfStream): string {
  const title = s.DisplayTitle || s.Title || s.Language || `Track ${s.Index}`;
  const codec = s.Codec?.toUpperCase();
  return codec && !title.toUpperCase().includes(codec) ? `${title} (${codec})` : title;
}

/** Extract language badge, codec badge, and clean title from a track label */
export function parseTrackLabel(raw: string): { title: string; lang: string | null; codec: string | null } {
  const parts = raw.split(" - ");
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].trim();
    const isCodec = /^[A-Z0-9]{2,8}$/i.test(last);
    return {
      title: parts.slice(0, isCodec ? -1 : undefined).join(" - "),
      codec: isCodec ? last : null,
      lang: extractLang(parts[0]),
    };
  }
  return { title: raw, codec: null, lang: extractLang(raw) };
}

/** ISO 639-2/3 (3-letter) → ISO 639-1 (2-letter) mapping.
 *  react-native-video requires ISO 639-1 for textTracks.language */
const ISO3_TO_ISO1: Record<string, string> = {
  eng: "en", fre: "fr", fra: "fr", spa: "es", ger: "de", deu: "de",
  jpn: "ja", ita: "it", por: "pt", rus: "ru", kor: "ko", zho: "zh",
  chi: "zh", ara: "ar", pol: "pl", dut: "nl", nld: "nl", cze: "cs",
  ces: "cs", hin: "hi", tha: "th", swe: "sv", nor: "no", nob: "no",
  nno: "no", fin: "fi", tur: "tr", hun: "hu", ron: "ro", rum: "ro",
  gre: "el", ell: "el", dan: "da", heb: "he", vie: "vi", ind: "id",
  may: "ms", msa: "ms", ukr: "uk", bul: "bg", hrv: "hr", srp: "sr",
  scc: "sr", cat: "ca", tam: "ta", tel: "te", per: "fa", fas: "fa",
  slo: "sk", slk: "sk", slv: "sl", lit: "lt", lav: "lv", est: "et",
  mal: "ml", ben: "bn", urd: "ur", fil: "tl", tgl: "tl",
};

/** Convert Jellyfin's ISO 639-2/3 language code to ISO 639-1 (2-letter).
 *  Returns the original code if already 2 letters, or "un" as fallback. */
export function toISO6391(lang: string | undefined): string {
  if (!lang) return "un";
  const lower = lang.toLowerCase();
  if (lower.length === 2) return lower;
  return ISO3_TO_ISO1[lower] ?? "un";
}

const LANG_MAP: Record<string, string> = {
  french: "FR", français: "FR", francais: "FR", fre: "FR", fra: "FR",
  english: "EN", anglais: "EN", eng: "EN",
  japanese: "JP", japonais: "JP", jpn: "JP",
  german: "DE", allemand: "DE", ger: "DE", deu: "DE",
  spanish: "ES", espagnol: "ES", spa: "ES",
  undetermined: "", und: "",
};

function extractLang(text: string): string | null {
  const lower = text.toLowerCase().trim();
  for (const [key, code] of Object.entries(LANG_MAP)) {
    if (lower.includes(key)) return code || null;
  }
  return null;
}
