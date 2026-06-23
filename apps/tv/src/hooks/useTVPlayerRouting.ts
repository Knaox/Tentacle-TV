import type { MPVPlayerHandle } from "../components/player/MPVPlayer";

/**
 * Décide vers quel lecteur natif router (ExoPlayer surface vs MPV) et expose les
 * dérivés de mode de lecture utilisés partout dans le PlayerScreen :
 *  - `useExoPlayer` : ExoPlayer rend directement à la surface (pas de copie
 *    mediacodec lag-inducing comme MPV). Forcé sur MPV uniquement en transcode.
 *  - `playerRef` : la ref active selon le lecteur sélectionné.
 *  - `requestedDirectPlay` : direct play DEMANDÉ (Android = décision finale ;
 *    tvOS = le hook .ios interroge PlaybackInfo et peut décider autrement).
 *  - `isDirectStream` : toujours false (parité contrat).
 *
 * `isDirectPlayRef` (nature réelle direct/transcode décidée par le serveur, lue
 * dans les callbacks sans en faire une dépendance) est créé par le caller et
 * SYNCHRONISÉ par lui (`isDirectPlayRef.current = isDirectPlay`) APRÈS
 * useTVStreamUrl : `requestedDirectPlay` (sortie d'ici) alimente ce hook de
 * stream alors que `isDirectPlay` (valeur du ref) en est une sortie.
 */
export function useTVPlayerRouting(args: {
  forceTranscode: boolean;
  isTranscodingQuality: boolean;
  exoRef: React.RefObject<MPVPlayerHandle | null>;
  mpvRef: React.RefObject<MPVPlayerHandle | null>;
}) {
  const { forceTranscode, isTranscodingQuality, exoRef, mpvRef } = args;

  // ExoPlayer rend directement à la surface (pas de copie mediacodec lag-inducing comme MPV).
  // Forcé sur MPV uniquement quand un transcode est en cours.
  const useExoPlayer = !forceTranscode;
  const playerRef = useExoPlayer ? exoRef : mpvRef;

  // Direct play DEMANDÉ tant qu'aucun transcode n'est imposé (codec ou qualité user).
  // Android : c'est aussi la décision finale. tvOS : le hook .ios interroge
  // PlaybackInfo et peut renvoyer un `isDirectPlay` différent (le serveur décide).
  const requestedDirectPlay = !forceTranscode && !isTranscodingQuality;
  const isDirectStream = false;

  return { useExoPlayer, playerRef, requestedDirectPlay, isDirectStream };
}
