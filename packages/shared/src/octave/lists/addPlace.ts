/**
 * Octave — OÙ entre un titre ajouté à une playlist (lot fl, 30/10, Damien : « en affichage personnalisé, un titre
 * que j'ajoute doit s'afficher en haut »). Pur.
 *
 * Serveur qui le sait (`music.addOnTop`, 1.41.0 : il date l'ajout aussitôt, « Derniers ajouts » reste juste) : EN
 * TÊTE de la playlist — l'ordre personnalisé d'une playlist à soi EST l'ordre de Jellyfin, et un titre que l'ordre
 * gardé ne connaît pas, sans prédécesseur, se pose en tête (`applyCustomOrder`). Une playlist PARTAGÉE garde la fin :
 * chacun y a son ordre et un ajout entre au bout de celui de chacun (`musicPlaylistMembers.ts`). Serveur d'avant :
 * la fin, comme avant.
 */

import { isSharedPlaylist } from "../../music/musicPlaylistMembers";

type PlaylistRights = Parameters<typeof isSharedPlaylist>[0];

/** La place d'un ajout : `0` (en tête), sinon `end` (absente : la fin). */
export function addPlace<T extends number | undefined>(playlist: PlaylistRights, onTop: boolean, end: T): number | T {
  return onTop && !isSharedPlaylist(playlist) ? 0 : end;
}
