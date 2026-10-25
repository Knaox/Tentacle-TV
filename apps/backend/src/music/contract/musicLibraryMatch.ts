/**
 * Octave — LA règle qui dit qu'un titre (ou un album) venu d'une extension EST
 * un élément de la bibliothèque : il est alors montré et JOUÉ comme celui de
 * la bibliothèque. Une seule règle, pure, pour le cœur (`POST /api/music/match`,
 * sur l'index local) et pour le client (les résultats de la recherche) — jamais
 * une source nommée. Recopiée octet pour octet dans le backend
 * (`apps/backend/src/music/contract/`, test miroir).
 *
 * Correspondance SÛRE, dans cet ordre :
 * 1. le MBID d'enregistrement (de parution pour un album) des deux côtés : il
 *    tranche seul — égal, c'est lui ; différent, ce n'est pas lui ;
 * 2. sinon le TITRE (normalisé, sans « feat. », « from … », « Remastered ») ET
 *    un artiste commun (par MBID ou par nom, crédits découpés) ET la durée à
 *    ± 2 s quand les deux la connaissent. Une compilation que Jellyfin crédite
 *    à « Various Artists » vaut l'artiste si l'ALBUM est le même ;
 * 3. dans un album déjà reconnu, un titre l'est par son titre, ou par sa place
 *    (disque, piste), toujours à ± 2 s.
 * Un homonyme (même titre, autre artiste, autre durée) n'est jamais pris.
 */

import type { Mbid } from "./musicTypes";

export const MATCH_DURATION_GAP_MS = 2_000;

/** L'identifiant MusicBrainz de « Various Artists » (artiste spécial des compilations). */
const VARIOUS_ARTISTS_MBID = "89ad4ac3-39f7-470e-963a-56509c546377";
const VARIOUS_NAMES = new Set(["various artists", "various", "va", "artistes divers", "artistes varies", "divers"]);

export interface MatchArtist {
  name: string;
  mbid: Mbid | null;
}

/** Ce qu'il faut d'un titre pour le comparer (bibliothèque comme extension). */
export interface MatchableTrack {
  title: string;
  artists: readonly MatchArtist[];
  albumTitle: string | null;
  durationMs: number | null;
  recording: Mbid | null;
  discNumber?: number | null;
  trackNumber?: number | null;
}

export interface MatchableAlbum {
  title: string;
  artists: readonly MatchArtist[];
  release: Mbid | null;
  releaseGroup: Mbid | null;
  /** Un recueil (compilation, bande originale) : « Various Artists » y est un artiste comme un autre. */
  compilation: boolean;
}

/** Casse, accents, ponctuation et espaces mis de côté (« Feel Good Inc. » = « feel good inc »). */
export function matchText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// Ce qui ne change pas l'enregistrement : un invité, l'œuvre d'où il vient, une remasterisation.
const NOISE_GROUP = /\s*[([][^)\]]*\b(?:feat|ft|featuring|with|from|remaster(?:ed)?|prod)\b[^)\]]*[)\]]/gi;
const NOISE_TAIL = /\s+(?:-\s+)?(?:\(?\s*(?:feat|ft|featuring)\.?\s.*|-\s+(?:\d{4}\s+)?remaster(?:ed)?(?:\s+\d{4})?(?:\s+version)?)$/i;

/** Le titre sans ce qui ne change pas l'enregistrement, tel quel (casse et accents gardés). */
export function stripTitleNoise(title: string): string {
  const stripped = title.replace(NOISE_GROUP, " ").replace(NOISE_TAIL, "").trim();
  return matchText(stripped).length > 0 ? stripped : title;
}

/** Le titre de BASE : sans invité, sans « (from … ) », sans « - Remastered 2011 » — une version (live, remix) reste. */
export function baseTitle(title: string): string {
  return matchText(stripTitleNoise(title));
}

const CREDIT_SPLIT = /\s*(?:,|;|\/|&|\+|\band\b|\bfeat\.?|\bft\.?|\bfeaturing\b|\bwith\b|\bx\b|\bvs\.?)\s*/i;

/** Les noms d'un crédit : chaque nom entier, et chacun des artistes qu'il réunit (« A feat. B & C » → a, b, c). */
export function creditNames(artists: readonly MatchArtist[]): Set<string> {
  const out = new Set<string>();
  for (const artist of artists) {
    const whole = matchText(artist.name);
    if (whole) out.add(whole);
    for (const part of artist.name.split(CREDIT_SPLIT)) {
      const name = matchText(part);
      if (name) out.add(name);
    }
  }
  return out;
}

function isVarious(artist: MatchArtist): boolean {
  return artist.mbid === VARIOUS_ARTISTS_MBID || VARIOUS_NAMES.has(matchText(artist.name));
}

/** Un crédit qui ne dit RIEN de l'artiste : vide, ou seulement « Various Artists ». */
export function isVariousCredit(artists: readonly MatchArtist[]): boolean {
  return artists.length === 0 || artists.every(isVarious);
}

/**
 * Un artiste en commun : par MBID, sinon par nom — « Various Artists » ne compte jamais. Le MBID est lu même
 * sous le nom « Various Artists » : Jellyfin y range parfois celui de l'interprète (tags d'une compilation).
 */
export function shareArtist(a: readonly MatchArtist[], b: readonly MatchArtist[]): boolean {
  const real = (x: MatchArtist) => x.mbid !== null && x.mbid !== VARIOUS_ARTISTS_MBID;
  const mbids = new Set(a.filter(real).map((x) => x.mbid));
  if (b.some((x) => real(x) && mbids.has(x.mbid))) return true;
  const names = creditNames(a.filter((x) => !isVarious(x)));
  for (const name of creditNames(b.filter((x) => !isVarious(x)))) if (names.has(name)) return true;
  return false;
}

export function sameTitle(a: string, b: string): boolean {
  return matchText(a) === matchText(b) || baseTitle(a) === baseTitle(b);
}

/** `true` si les deux durées sont connues et à ± 2 s ; `null` si l'une manque. */
export function closeDuration(a: number | null, b: number | null): boolean | null {
  if (a === null || b === null || a <= 0 || b <= 0) return null;
  return Math.abs(a - b) <= MATCH_DURATION_GAP_MS;
}

/** Le verdict des MBID : `true`/`false` s'ils tranchent, `null` s'il en manque un. */
function mbidVerdict(a: Mbid | null, b: Mbid | null): boolean | null {
  return a && b ? a.toLowerCase() === b.toLowerCase() : null;
}

/** Un titre de l'extension (`candidate`) EST-il ce titre de la bibliothèque (`own`) ? */
export function isSameTrack(own: MatchableTrack, candidate: MatchableTrack): boolean {
  const byMbid = mbidVerdict(own.recording, candidate.recording);
  if (byMbid !== null) return byMbid;
  if (!sameTitle(own.title, candidate.title)) return false;
  if (closeDuration(own.durationMs, candidate.durationMs) === false) return false;
  if (shareArtist(own.artists, candidate.artists)) return true;
  // Une compilation créditée à « Various Artists » : c'est l'album qui dit l'artiste.
  const various = isVariousCredit(own.artists) || isVariousCredit(candidate.artists);
  return various && own.albumTitle !== null && candidate.albumTitle !== null && sameTitle(own.albumTitle, candidate.albumTitle) && closeDuration(own.durationMs, candidate.durationMs) === true;
}

/** Un album de l'extension EST-il cet album de la bibliothèque ? (Ses titres disent ensuite ce qui y est.) */
export function isSameAlbum(own: MatchableAlbum, candidate: MatchableAlbum): boolean {
  const byRelease = mbidVerdict(own.release, candidate.release);
  if (byRelease === true) return true;
  const byGroup = mbidVerdict(own.releaseGroup, candidate.releaseGroup);
  if (byGroup !== null) return byGroup;
  if (byRelease === false) return false;
  if (!sameTitle(own.title, candidate.title)) return false;
  if (shareArtist(own.artists, candidate.artists)) return true;
  // Un recueil : « Various Artists » d'un côté, les interprètes de l'autre — le titre exact suffit.
  const recueil = own.compilation || candidate.compilation || isVariousCredit(own.artists) || isVariousCredit(candidate.artists);
  return recueil && matchText(own.title) === matchText(candidate.title);
}

/** Dans un album RECONNU : ce titre de l'extension est-il celui-là ? Titre ou place, à ± 2 s. */
export function isSameAlbumTrack(own: MatchableTrack, candidate: MatchableTrack): boolean {
  const byMbid = mbidVerdict(own.recording, candidate.recording);
  if (byMbid !== null) return byMbid;
  const duration = closeDuration(own.durationMs, candidate.durationMs);
  if (duration === false) return false;
  if (sameTitle(own.title, candidate.title)) return true;
  const placed = own.trackNumber != null && own.trackNumber === candidate.trackNumber && (own.discNumber ?? 1) === (candidate.discNumber ?? 1);
  return placed && duration === true;
}

/** Le meilleur élément de la bibliothèque pour `candidate` : le plus proche en durée parmi ceux qui conviennent. */
export function bestMatch<T>(candidate: MatchableTrack, own: readonly T[], view: (item: T) => MatchableTrack, same = isSameTrack): T | null {
  let best: T | null = null;
  let gap = Infinity;
  for (const item of own) {
    const track = view(item);
    if (!same(track, candidate)) continue;
    const d = track.durationMs !== null && candidate.durationMs !== null ? Math.abs(track.durationMs - candidate.durationMs) : MATCH_DURATION_GAP_MS;
    if (d < gap) {
      best = item;
      gap = d;
    }
  }
  return best;
}
