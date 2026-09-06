/**
 * Le titre en cours de lecture LOCALE, connu du runtime hors ligne : la purge
 * des échéances l'épargne (une application restée derrière plus d'une minute
 * a un battement périmé — sans ceci, le retour au premier plan effaçait le
 * fichier sous le lecteur), et rien ne part sur le réseau tant qu'il joue.
 */

let nowPlaying: string | null = null;

export function setNowPlaying(itemId: string): void {
  nowPlaying = itemId;
}

/** Ne libère que si c'est encore lui (un autre lecteur a pu prendre la suite). */
export function clearNowPlaying(itemId: string): void {
  if (nowPlaying === itemId) nowPlaying = null;
}

export const nowPlayingItemId = (): string | null => nowPlaying;

export const isLocalPlaybackActive = (): boolean => nowPlaying !== null;
