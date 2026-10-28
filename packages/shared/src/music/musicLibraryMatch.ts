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
const VARIOUS_NAMES = new Set([
  "various artists", "various artist", "various", "va", "v a", "artistes divers", "artistes varies", "divers",
  "varios artistas", "diversos artistas", "artisti vari", "verschiedene interpreten", "verschiedene kunstler", "multiple artists",
]);

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
  /** L'artiste de l'ALBUM (Jellyfin `AlbumArtist`) : « Various Artists » y dit un recueil. */
  albumArtist?: string | null;
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

// Ce qui ne change pas l'enregistrement : un invité, l'œuvre d'où il vient, une remasterisation — aussi dans les
// mots d'une boutique TRADUITE (« extrait de la série », « tiré du film », « avec », « remasterisé »…) : sans eux,
// un titre importé d'une page française gardait sa mention et la bibliothèque ne le reconnaissait plus.
// Jamais de « (?<!…) » : un Safari d'avant 16.4 refuserait le module entier ; la borne gauche se CONSOMME.
const NOISE_WORDS = String.raw`feat|ft|featuring|with|avec|con|mit|from|extrait|tir[ée]e?s?|issue?s?|bande originale|de la s[ée]rie|du film|de la pel[íi]cula|aus de[rm]|dalla serie|dal film|da s[ée]rie|do filme|remaster\p{L}*|prod`;
const NOISE_GROUP = new RegExp(String.raw`\s*[([](?:[^)\]]*[^\p{L}\p{N})\]])?(?:${NOISE_WORDS})(?![\p{L}\p{N}])[^)\]]*[)\]]`, "giu");
// Une VERSION n'est jamais un bruit, même « (Live from Wembley) » : c'est un autre enregistrement.
const VERSION_WORDS = /(?:^|[^\p{L}\p{N}])(?:live|remix|mix|acoustic|acoustique|ac[uú]stico|unplugged|instrumental|demo|edit|karaok[eé]|en vivo|en direct|dal vivo)(?![\p{L}\p{N}])/iu;
const NOISE_TAIL = new RegExp(
  String.raw`\s+(?:-\s+)?(?:\(?\s*(?:feat|ft|featuring)\.?\s.*|-\s+(?:\d{4}\s+)?remaster\p{L}*(?:\s+\d{4})?(?:\s+version)?|-\s+(?:from|extrait|tir[ée]e?|issue?)\s.*)$`,
  "iu",
);

/** Le titre sans ce qui ne change pas l'enregistrement, tel quel (casse et accents gardés). */
export function stripTitleNoise(title: string): string {
  const stripped = title.replace(NOISE_GROUP, (group) => (VERSION_WORDS.test(group) ? group : " ")).replace(NOISE_TAIL, "").trim();
  return matchText(stripped).length > 0 ? stripped : title;
}

/** Le titre de BASE : sans invité, sans « (from … ) », sans « - Remastered 2011 » — une version (live, remix) reste. */
export function baseTitle(title: string): string {
  return matchText(stripTitleNoise(title));
}

// Sans « \s* » autour : une longue suite d'espaces y faisait reprendre le motif à chaque position (temps
// quadratique, CodeQL js/polynomial-redos) ; `matchText` retire de toute façon les espaces de chaque part.
const CREDIT_SPLIT = /,|;|\/|&|\+|\band\b|\bfeat\.?|\bft\.?|\bfeaturing\b|\bwith\b|\bx\b|\bvs\.?/i;

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

// Ce qui ne change pas l'ALBUM : son édition (« Collector's Edition », « Deluxe », « Explicit », « 2016 Remaster »).
const EDITION_WORD = /\b(?:deluxe|edition|expanded|explicit|clean|bonus|anniversary|special|collectors?|remaster(?:ed)?)\b/i;

/**
 * Le titre sans ses groupes d'édition : chaque « (…) » ou « […] » (fermé par le premier « ) » ou « ] ») qui
 * dit une édition. Parcours LINÉAIRE — l'ancienne expression, `[^)\]]*\b(?:…)\b[^)\]]*` derrière un `\s*`,
 * reprenait chaque suite d'espaces ou de parenthèses (CodeQL js/polynomial-redos). Les espaces autour, que
 * l'ancienne retirait devant le groupe, sont laissés à `matchText`.
 */
export function withoutEditionGroups(title: string): string {
  let out = "";
  let from = 0;
  let open = 0;
  while (open < title.length) {
    const char = title[open];
    if (char !== "(" && char !== "[") {
      open += 1;
      continue;
    }
    let close = open + 1;
    while (close < title.length && title[close] !== ")" && title[close] !== "]") close += 1;
    if (close >= title.length) break; // plus aucune fermeture : plus aucun groupe
    // Une ouverture DANS ce groupe a la même fermeture et un contenu plus court : elle ne dit rien de plus.
    if (EDITION_WORD.test(title.slice(open + 1, close))) {
      out += `${title.slice(from, open)} `;
      from = close + 1;
    }
    open = close + 1;
  }
  return out + title.slice(from);
}

/** Deux titres d'album : le même, édition mise de côté (une B.O. « Score » n'est pas la « Soundtrack »). */
export function sameAlbumTitle(a: string, b: string): boolean {
  return sameTitle(a, b) || matchText(withoutEditionGroups(a)) === matchText(withoutEditionGroups(b));
}

/** Un titre d'un RECUEIL : crédité « Various Artists » (ou rien), ou dans un album de « Various Artists ». */
function onCompilation(track: MatchableTrack): boolean {
  return isVariousCredit(track.artists) || (track.albumArtist != null && VARIOUS_NAMES.has(matchText(track.albumArtist)));
}

/** Le verdict des MBID : `true`/`false` s'ils tranchent, `null` s'il en manque un. */
function mbidVerdict(a: Mbid | null, b: Mbid | null): boolean | null {
  return a && b ? a.toLowerCase() === b.toLowerCase() : null;
}

/**
 * Un titre de l'extension (`candidate`) EST-il ce titre de la bibliothèque (`own`) ?
 *
 * Dans un RECUEIL (« Various Artists » d'un côté, crédit ou album-artiste), même titre, même album (édition à part)
 * et même durée suffisent : c'est lui, même sous deux MBID d'enregistrement — Damien, 26/10 : « Sucker for Pain »
 * rangé par Lidarr en « Various Artists », un autre enregistrement que celui demandé, restait « en attente » pendant
 * qu'il jouait depuis la bibliothèque. Hors recueil, les MBID tranchent comme avant.
 */
export function isSameTrack(own: MatchableTrack, candidate: MatchableTrack): boolean {
  const titled = sameTitle(own.title, candidate.title);
  const sameAlbum = own.albumTitle !== null && candidate.albumTitle !== null && sameAlbumTitle(own.albumTitle, candidate.albumTitle);
  if (titled && sameAlbum && (onCompilation(own) || onCompilation(candidate)) && closeDuration(own.durationMs, candidate.durationMs) === true) return true;
  const byMbid = mbidVerdict(own.recording, candidate.recording);
  if (byMbid !== null) return byMbid;
  if (!titled) return false;
  if (closeDuration(own.durationMs, candidate.durationMs) === false) return false;
  return shareArtist(own.artists, candidate.artists);
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

/** L'écart toléré au SECOND rang : ± 5 s, ou ± 3 % d'un long titre. */
export const MATCH_LOOSE_GAP_MS = 5_000;
const MATCH_LOOSE_RATIO = 0.03;

/**
 * Le SECOND rang : le même titre, un artiste commun, et la durée d'un AUTRE master du même enregistrement (± 5 s,
 * ± 3 %). Une boutique et le fichier de la bibliothèque (une autre parution, un encodage, un silence de fin) ne
 * tombent pas toujours à ± 2 s ; une autre VERSION (live, remix, avec d'autres invités) s'écarte bien davantage ou
 * porte un autre titre. Les MBID, quand les deux côtés en ont, tranchent toujours.
 */
export function isLikelySameTrack(own: MatchableTrack, candidate: MatchableTrack): boolean {
  if (isSameTrack(own, candidate)) return true;
  if (mbidVerdict(own.recording, candidate.recording) !== null) return false;
  if (!sameTitle(own.title, candidate.title) || own.durationMs === null || candidate.durationMs === null) return false;
  const gap = Math.abs(own.durationMs - candidate.durationMs);
  if (gap > Math.max(MATCH_LOOSE_GAP_MS, Math.max(own.durationMs, candidate.durationMs) * MATCH_LOOSE_RATIO)) return false;
  return shareArtist(own.artists, candidate.artists);
}

/**
 * Le rang d'un élément qui convient (le plus petit l'emporte) : l'ALBUM de la source d'abord (un titre présent sur
 * plusieurs albums de la bibliothèque est rangé dans celui d'où il vient), puis la correspondance de premier rang,
 * puis l'album de l'artiste plutôt qu'un recueil, puis la durée la plus proche.
 */
function rankOf(own: MatchableTrack, candidate: MatchableTrack): number[] {
  const fromSource = own.albumTitle !== null && candidate.albumTitle !== null && sameAlbumTitle(own.albumTitle, candidate.albumTitle);
  const gap = own.durationMs !== null && candidate.durationMs !== null ? Math.abs(own.durationMs - candidate.durationMs) : MATCH_DURATION_GAP_MS;
  return [fromSource ? 0 : 1, closeDuration(own.durationMs, candidate.durationMs) === false ? 1 : 0, onCompilation(own) ? 1 : 0, gap];
}

const before = (a: readonly number[], b: readonly number[]) => {
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return (a[i] as number) < (b[i] as number);
  return false;
};

/** Le meilleur élément de la bibliothèque pour `candidate` parmi ceux qui conviennent (`same`), au rang de `rankOf`. */
export function bestMatch<T>(candidate: MatchableTrack, own: readonly T[], view: (item: T) => MatchableTrack, same = isSameTrack): T | null {
  let best: { item: T; rank: number[] } | null = null;
  for (const item of own) {
    const track = view(item);
    if (!same(track, candidate)) continue;
    const rank = rankOf(track, candidate);
    if (!best || before(rank, best.rank)) best = { item, rank };
  }
  return best?.item ?? null;
}

/** Un titre seul face à toute la bibliothèque : le premier rang, sinon le second (`isLikelySameTrack`), même classement. */
export function bestTrackMatch<T>(candidate: MatchableTrack, own: readonly T[], view: (item: T) => MatchableTrack): T | null {
  return bestMatch(candidate, own, view, isLikelySameTrack);
}
