/**
 * Les langues d'un média (pistes audio, sous-titres), en toutes lettres dans
 * la langue de l'interface — pur.
 *
 * Jellyfin rend les codes ISO 639-2, souvent sous leur forme BIBLIOGRAPHIQUE
 * (`fre`, `ger`), que `Intl.DisplayNames` ne connaît pas : on les ramène au
 * code à deux lettres. Sans `Intl.DisplayNames` (Hermes, vieux moteurs), le
 * code reste affiché en capitales — lisible, jamais faux.
 */

import type { MediaStream } from "../types/media";

const BIBLIOGRAPHIC: Record<string, string> = {
  fre: "fr", fra: "fr", ger: "de", deu: "de", eng: "en", spa: "es", ita: "it", por: "pt", jpn: "ja",
  kor: "ko", chi: "zh", zho: "zh", dut: "nl", nld: "nl", rus: "ru", ara: "ar", hin: "hi", swe: "sv",
  nor: "no", nob: "nb", dan: "da", fin: "fi", pol: "pl", cze: "cs", ces: "cs", gre: "el", ell: "el",
  tur: "tr", heb: "he", hun: "hu", rum: "ro", ron: "ro", ukr: "uk", tha: "th", vie: "vi", ind: "id",
  may: "ms", msa: "ms", per: "fa", fas: "fa", slo: "sk", slk: "sk", ice: "is", isl: "is", cat: "ca",
  hrv: "hr", srp: "sr", bul: "bg", est: "et", lav: "lv", lit: "lt", slv: "sl", tam: "ta", tel: "te",
};

/** Le code d'une piste ramené à deux lettres, ou `null` s'il ne dit rien (`und`). */
export function normalizeLanguageCode(code: string | null | undefined): string | null {
  if (typeof code !== "string") return null;
  const c = code.trim().toLowerCase();
  if (c === "" || c === "und" || c === "mis" || c === "zxx" || c === "mul") return null;
  if (BIBLIOGRAPHIC[c]) return BIBLIOGRAPHIC[c];
  return /^[a-z]{2}(-[a-z0-9]+)?$/.test(c) ? c : null;
}

type LanguageNamer = (code: string) => string;

function namer(locale: string): LanguageNamer {
  const Ctor = (Intl as unknown as { DisplayNames?: new (l: string[], o: { type: string }) => { of: (c: string) => string | undefined } }).DisplayNames;
  if (typeof Ctor !== "function") return (code) => code.toUpperCase();
  try {
    const names = new Ctor([locale], { type: "language" });
    return (code) => {
      const name = names.of(code);
      return name && name !== code ? name.charAt(0).toLocaleUpperCase(locale) + name.slice(1) : code.toUpperCase();
    };
  } catch {
    return (code) => code.toUpperCase();
  }
}

/** Le nom d'une langue dans celle de l'interface (« fr » → « Français »), le code à défaut. */
export function languageName(code: string, locale: string): string {
  const normalized = normalizeLanguageCode(code);
  return normalized ? namer(locale)(normalized) : code.toUpperCase();
}

/** Les langues distinctes des pistes d'un type, dans l'ordre du fichier. */
export function streamLanguages(
  streams: readonly MediaStream[] | null | undefined,
  type: "Audio" | "Subtitle",
  locale: string,
): string[] {
  const name = namer(locale);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of streams ?? []) {
    if (s.Type !== type) continue;
    const code = normalizeLanguageCode(s.Language);
    if (code === null || seen.has(code)) continue;
    seen.add(code);
    out.push(name(code));
  }
  return out;
}
