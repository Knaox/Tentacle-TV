import type { AdminNowPlayingDto } from "../types/adminSessionsDto";

/**
 * Une ÉCOUTE dans le tableau de bord des sessions (la musique d'Octave, de la
 * bibliothèque ou d'une extension) — UNE règle pour toutes les cartes :
 *
 * - sa pochette est CARRÉE (une affiche est en 2:3) ;
 * - sous le titre, « Artistes · Album » (une vidéo y met son année) ;
 * - on la met en pause, on la reprend, on l'arrête — on ne lui envoie pas de
 *   message : il n'y a pas d'écran où l'afficher.
 */

type ListeningFields = Pick<AdminNowPlayingDto, "type" | "artists" | "album" | "fromExtension">;

/** Le son seul — un clip (`MusicVideo`) a une image, donc un écran. */
const LISTENING_TYPES: ReadonlySet<string> = new Set(["Audio", "AudioBook"]);

export function isListening(item: Pick<AdminNowPlayingDto, "type" | "fromExtension">): boolean {
  return item.fromExtension === true || LISTENING_TYPES.has(item.type);
}

/** « Artistes · Album », ou `null` sans l'un ni l'autre (serveur d'avant `sessions.musicControl`). */
export function listeningLine(item: ListeningFields): string | null {
  if (!isListening(item)) return null;
  const parts = [item.artists?.trim(), item.album?.trim()].filter((p): p is string => p !== undefined && p !== "");
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Ce que la carte offre : un message n'a de sens que là où un écran l'affiche. */
export function sessionOffersMessage(item: Pick<AdminNowPlayingDto, "type" | "fromExtension"> | null): boolean {
  return item === null || !isListening(item);
}
