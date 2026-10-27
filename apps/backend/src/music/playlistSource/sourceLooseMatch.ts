/**
 * Octave — reconnaître un élément d'une playlist importée parmi les titres de SA source, en monde CLOS (pur).
 *
 * LA règle du cœur (`bestTrackMatch`) cherche un titre dans toute une bibliothèque : elle exige un artiste commun.
 * Or la source et Jellyfin écrivent souvent l'artiste dans deux écritures (« 田中明 » chez Apple Music,
 * « Akira Tanaka » dans les étiquettes de Lidarr), et parfois le titre (« 夜明けの歌 » / « Yoake no Uta ») —
 * relevé du 27/10 sur une playlist importée : 26 des 153 entrées sans artiste commun. Ici, les candidats ne
 * sont que les titres ENCORE LIBRES de la source de cette playlist, et l'élément y est entré pour l'un d'eux :
 * on peut se fier
 * — au même titre de base (sans parenthèses ni crochets ni ponctuation) avec une durée proche, le même album ou un
 * artiste commun ;
 * — sinon à une durée quasi identique (± 1 s), si UN seul titre libre l'a.
 */

import type { IndexRow } from "../index/indexTypes";
import type { SourceSlot } from "./sourceRecord";

/** Un titre ou un album réduit à ses lettres et chiffres (toute écriture), sans ce qui est entre parenthèses. */
export function baseTitle(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\s[-–—]\s.*$/, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

const NEAR_MS = 3_000;
const SAME_MS = 1_000;

const gap = (slot: SourceSlot, row: IndexRow): number =>
  slot.durationMs !== null && row.durationMs !== null ? Math.abs(slot.durationMs - row.durationMs) : Number.POSITIVE_INFINITY;

function sameArtist(slot: SourceSlot, row: IndexRow): boolean {
  const own = new Set(row.artists.map((a) => baseTitle(a.name)).filter(Boolean));
  return slot.artists.some((name) => own.has(baseTitle(name)));
}

function sameAlbum(slot: SourceSlot, row: IndexRow): boolean {
  return slot.album !== null && row.albumName !== null && baseTitle(slot.album) !== "" && baseTitle(slot.album) === baseTitle(row.albumName);
}

/** Le titre libre de même titre de base (durée proche, même album ou artiste commun) ; le plus proche en durée. */
export function namedSlot(free: readonly SourceSlot[], row: IndexRow): SourceSlot | null {
  const title = baseTitle(row.name);
  const named = title ? free.filter((s) => baseTitle(s.title) === title && (gap(s, row) <= NEAR_MS || sameAlbum(s, row) || sameArtist(s, row))) : [];
  return named.length > 0 ? [...named].sort((a, b) => gap(a, row) - gap(b, row) || a.rank - b.rank)[0]! : null;
}

/** Le SEUL titre libre de durée quasi identique (± 1 s) : un titre écrit dans une autre écriture. */
export function timedSlot(free: readonly SourceSlot[], row: IndexRow): SourceSlot | null {
  const timed = free.filter((s) => gap(s, row) <= SAME_MS);
  return timed.length === 1 ? timed[0]! : null;
}

/** Le titre libre de la source que cet élément est, en monde clos ; `null` si rien ne le dit sûrement. */
export function looseSlot(free: readonly SourceSlot[], row: IndexRow): SourceSlot | null {
  return namedSlot(free, row) ?? timedSlot(free, row);
}
