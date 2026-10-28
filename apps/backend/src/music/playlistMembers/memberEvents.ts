/**
 * Octave — ce qu'apprennent les personnes d'une playlist partagée : à chaque geste sur elle, son propriétaire
 * et chacun de ses membres relisent (`music:playlist`) ; un partage reçu, retiré ou quitté fait relire la
 * liste des playlists du compte concerné. Rien ne fait échouer le geste qui l'a causé.
 */

import { normalizeId } from "../jellyfin/musicJellyfin";
import { forgetUserPlaylists } from "../playlists/playlistJellyfin";
import { tellPlaylistChanged } from "../events/musicLiveEvents";
import { membersEnabled } from "./playlistAccess";
import { idOf, membersOf } from "./memberStore";

/** Le propriétaire et les membres relisent la playlist, sauf ceux déjà prévenus (`told`). */
export async function tellPlaylistPeople(playlistId: string, told: readonly string[] = []): Promise<void> {
  if (!membersEnabled()) return;
  try {
    const members = await membersOf(playlistId);
    if (members.length === 0) return;
    const skip = new Set(told.map(idOf));
    const people = new Set([members[0]!.ownerUserId, ...members.map((m) => m.memberId), ...told.map(idOf)]);
    for (const person of people) if (!skip.has(person)) tellPlaylistChanged(person, normalizeId(playlistId));
  } catch {
    // Une base muette : chacun relira à sa prochaine visite.
  }
}

/** Ces comptes relisent la playlist (un membre ajouté, retiré, qui part) — leur liste aussi. */
export function tellAccountsAbout(playlistId: string, accounts: readonly string[]): void {
  for (const account of new Set(accounts.map(idOf))) {
    forgetUserPlaylists(account);
    tellPlaylistChanged(account, normalizeId(playlistId));
  }
}
