/**
 * Octave — la place que prend la musique gardée, règle PURE
 * (`keptStorage.test.ts`) : par album, par playlist, en tout. Ce que montrent
 * l'en-tête d'une collection gardée (`KeptSizeMeta`), son menu et la vue « Sur
 * cet appareil ».
 *
 * Une copie ne compte qu'UNE fois : un titre qui a changé d'identité depuis
 * qu'il a été gardé mène à la copie de son ancienne clé (`keptRenames.ts`), et
 * deux entrées d'une playlist peuvent être le même titre. On compte les octets
 * ÉCRITS (`bytesDone`) : la taille d'un Allégé n'est qu'une estimation jusqu'au
 * bout, et une copie en préparation prend déjà sa place.
 */

import type { KeptMusicTrack } from "../core/musicLibrary";

/** Les copies sur le disque des titres `keys`, chacune une fois ; un titre retiré (`canceled`) n'en a plus. */
export function copiesOf(keys: readonly string[], byKey: ReadonlyMap<string, KeptMusicTrack>): KeptMusicTrack[] {
  const out = new Map<number, KeptMusicTrack>();
  for (const key of keys) {
    const copy = byKey.get(key);
    if (copy && copy.status !== "canceled") out.set(copy.fileId, copy);
  }
  return [...out.values()];
}

/** La place qu'elles prennent, en octets. */
export function bytesOnDisk(copies: readonly KeptMusicTrack[]): number {
  return copies.reduce((sum, copy) => sum + (copy.status === "canceled" ? 0 : Math.max(0, copy.bytesDone)), 0);
}

/** La place d'un album ou d'une playlist (les clés de ses titres). */
export function collectionBytes(keys: readonly string[], byKey: ReadonlyMap<string, KeptMusicTrack>): number {
  return bytesOnDisk(copiesOf(keys, byKey));
}
