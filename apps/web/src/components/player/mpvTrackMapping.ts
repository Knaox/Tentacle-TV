import { LANGUAGE_CODE_GROUPS } from "@tentacle-tv/offline-core";
import type { MpvTrack } from "../../hooks/useDesktopPlayer";

export { primaryLangSubtag } from "@tentacle-tv/offline-core";

// ── Normalisation des codes de langue ──
// ISO 639-1 (ja, fr), 639-2/B (fre, ger) et 639-2/T (fra, deu) : toutes les
// variantes d'une langue vont au même code canonique (639-2/T). La table vit
// dans le cœur hors ligne, partagée avec le mobile.
const LANG_NORM: Record<string, string> = {};
for (const group of LANGUAGE_CODE_GROUPS) {
  const canon = group[group.length - 1] ?? "";
  for (const c of group) LANG_NORM[c] = canon;
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
