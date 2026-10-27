/**
 * Octave — une insertion de l'API d'hôte (`jellyfin.playlistInsert`, l'extension qui fait venir les absents) dans
 * une playlist IMPORTÉE : à SA place dans l'ordre de la source, lue dans la playlist TELLE QU'ELLE EST, sous son
 * verrou (`insertAt`). La position que l'extension envoie a été calculée à l'import et chaque insertion la rendait
 * fausse (27/10, une playlist importée d'Apple Music : 59 inversions, présents rejetés à la fin à l'envers) :
 * elle n'est plus qu'un repli — playlist sans relevé (importée avant la 1.40.0, pas encore réparée), titre que
 * rien ne relie à la source.
 *
 * L'élément posé est lié à son titre dans le relevé : il sert de repère aux suivants et date « Date d'ajout ».
 */

import { sourcePlace } from "../contract/musicSourceOrder";
import { rowsByIds } from "../index/indexQueries";
import { normalizeId } from "../jellyfin/musicJellyfin";
import { insertAt, type PlaylistResult } from "../playlists/playlistService";
import { rankForInsert } from "./sourceBinding";
import { bound, ranksByItem } from "./sourceRecord";
import { readPlaylistSource, savePlaylistSource } from "./sourceStore";

/** Insère pour l'extension ; `sourceIndex` : le rang du titre dans la source de l'import. Rend la place prise. */
export function insertFromHost(userId: string, playlistId: string, itemIds: string[], position: number, sourceIndex?: number): Promise<PlaylistResult<number>> {
  const ids = itemIds.map(normalizeId);
  let keep: (() => Promise<void>) | null = null;
  return insertAt(
    userId,
    playlistId,
    ids,
    async (before) => {
      const record = await readPlaylistSource(playlistId).catch(() => null);
      if (!record || ids.length === 0) return position;
      const row = (await rowsByIds(ids.slice(0, 1)).catch(() => new Map())).get(ids[0]!) ?? null;
      const found = rankForInsert(record, row, sourceIndex);
      if (!found) return position;
      keep = () => savePlaylistSource(bound(record, found.rank, ids));
      if (!found.place) return position;
      const ranks = ranksByItem(record);
      return sourcePlace(before.map((e) => ranks.get(e.itemId) ?? null), found.rank) ?? position;
    },
    async () => {
      await keep?.().catch((error: unknown) => console.warn("[music] liaison à l'ordre de la source non gardée :", (error as Error).message));
    },
  );
}
