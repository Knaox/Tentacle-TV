/**
 * Le moteur de lecture est-il mpv ? Android TV : ExoPlayer pour la lecture
 * directe, mpv pour le transcodage (`useTVPlayerRouting` : `useExoPlayer =
 * !forceTranscode`). L'Apple TV a sa variante (`streamEngine.ios.ts`). Lu par
 * la règle du retour de Jellyfin (shared `mpvStreamLost`).
 */
export function engineIsMpv(useExoPlayer: boolean): boolean {
  return !useExoPlayer;
}
