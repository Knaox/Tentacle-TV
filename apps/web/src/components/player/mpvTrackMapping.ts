import type { MpvTrack } from "../../hooks/useDesktopPlayer";

// ── Comprehensive language code normalization ──
// Handles ISO 639-1 (ja, fr), 639-2/B (fre, ger) and 639-2/T (fra, deu).
// All variants for each language map to the same canonical (639-2/T) code.
const LANG_NORM: Record<string, string> = {};
/** Code canonique (639-2/T) → sous-tag primaire ISO 639-1, pour Intl.DisplayNames. */
const LANG_PRIMARY: Record<string, string> = {};
([
  ["ja", "jpn"], ["fr", "fre", "fra"], ["en", "eng"], ["de", "ger", "deu"],
  ["es", "spa"], ["it", "ita"], ["pt", "por"], ["ru", "rus"],
  ["zh", "chi", "zho"], ["ko", "kor"], ["ar", "ara"], ["nl", "dut", "nld"],
  ["pl", "pol"], ["cs", "cze", "ces"], ["hu", "hun"], ["ro", "rum", "ron"],
  ["el", "gre", "ell"], ["tr", "tur"], ["he", "heb"], ["th", "tha"],
  ["vi", "vie"], ["hi", "hin"], ["uk", "ukr"], ["sv", "swe"],
  ["no", "nor"], ["da", "dan"], ["fi", "fin"], ["hr", "hrv"],
  ["sk", "slo", "slk"], ["sr", "srp"], ["bg", "bul"], ["sl", "slv"],
  ["is", "ice", "isl"], ["cy", "wel", "cym"], ["eu", "baq", "eus"],
  ["sq", "alb", "sqi"], ["hy", "arm", "hye"], ["ka", "geo", "kat"],
  ["mk", "mac", "mkd"], ["ms", "may", "msa"], ["my", "bur", "mya"],
  ["fa", "per", "fas"], ["bo", "tib", "bod"], ["la", "lat"],
  ["nb", "nob"], ["nn", "nno"], ["ta", "tam"], ["te", "tel"],
] as string[][]).forEach(group => {
  const canon = group[group.length - 1];
  const primary = group[0]; // toujours le code ISO 639-1 dans ces groupes
  group.forEach(c => { LANG_NORM[c] = canon; LANG_PRIMARY[c] = primary; });
});

/**
 * Sous-tag primaire à 2 lettres d'un code de langue (« fre »/« fra » → « fr »).
 * Intl.DisplayNames ne reconnaît pas les codes ISO 639-2/B que rend mpv.
 * null si le code est inconnu de la table.
 */
export function primaryLangSubtag(code: string | undefined): string | null {
  if (!code) return null;
  const lower = code.toLowerCase();
  return LANG_PRIMARY[lower] ?? (/^[a-z]{2}$/.test(lower) ? lower : null);
}

/** Compare two language codes — normalizes all ISO 639 variants. */
export function langMatch(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return (LANG_NORM[a] ?? a) === (LANG_NORM[b] ?? b);
}

/** Get the best subtitle delivery format for mpv based on codec. */
export function nativeSubFormat(codec?: string): string {
  switch (codec?.toLowerCase()) {
    case "ass": case "ssa": return "ass";
    case "srt": case "subrip": return "srt";
    default: return "srt";
  }
}

/** Replace .vtt extension in a Jellyfin subtitle URL with the given format. */
export function nativeSubUrl(url: string, codec?: string): string {
  return url.replace(/Stream\.vtt/, `Stream.${nativeSubFormat(codec)}`);
}

// ── Language-based mapping: Jellyfin index → MPV track ID ──

/**
 * Find the MPV track that best matches a Jellyfin track by language, then position fallback.
 *
 * ⚠️ Les pistes EXTERNES au conteneur sont écartées d'abord. Elles n'existent
 * pas dans la track-list de mpv : les compter décalait le rang de toutes les
 * internes suivantes, et une externe DEMANDÉE se voyait substituer une interne
 * de même langue — mauvaise piste à l'écran, plus un `set sid` inutile qui fait
 * jeter à mpv tout son cache (bug amont, mpv#8422). Rendre `null` est la bonne
 * réponse : l'appelant sait alors qu'il faut passer par `sub-add`.
 */
export function findMpvTrack(
  jfIndex: number,
  jfTracks: { index: number; lang?: string; external?: boolean }[],
  mpvTracks: MpvTrack[],
): number | null {
  const internal = jfTracks.filter((t) => t.external !== true);
  const jfPos = internal.findIndex((t) => t.index === jfIndex);
  if (jfPos < 0) return null;
  const jfLang = internal[jfPos].lang;

  // 1. Try language match (handles all ISO 639 variants)
  if (jfLang) {
    const sameJfBefore = internal.slice(0, jfPos).filter((t) => langMatch(t.lang, jfLang)).length;
    const langMatches = mpvTracks.filter((t) => langMatch(t.lang, jfLang));
    if (sameJfBefore < langMatches.length) return langMatches[sameJfBefore].id;
    if (langMatches.length > 0) return langMatches[0].id;
    // Language match failed — fall through to positional
  }

  // 2. Positional fallback: use when no language info OR when language matching failed
  if (jfPos < mpvTracks.length) return mpvTracks[jfPos].id;

  return null;
}
