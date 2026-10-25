import type { AdminSessionDto } from "./dto";

/**
 * Une ÉCOUTE (musique de la bibliothèque, livre audio, lecture d'extension) n'a
 * pas d'écran où afficher un message : le serveur le refuse (409), la carte ne
 * le propose pas. Le jumeau côté clients est `packages/shared/src/adminSessions/
 * listening.ts` (le backend n'importe pas shared à l'exécution) : mêmes types.
 */

/** Le son seul — un clip (`MusicVideo`) a une image, donc un écran. */
const LISTENING_TYPES: ReadonlySet<string> = new Set(["Audio", "AudioBook"]);

export function refusesMessage(session: Pick<AdminSessionDto, "nowPlaying"> | undefined): boolean {
  const item = session?.nowPlaying;
  return item != null && (item.fromExtension === true || LISTENING_TYPES.has(item.type));
}
