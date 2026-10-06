/**
 * Apple TV : jamais mpv — le wrapper « MPV » y rend la surface AVPlayer
 * (`MPVPlayer.ios.tsx`). Voir `streamEngine.ts`.
 */
export function engineIsMpv(_useExoPlayer: boolean): boolean {
  return false;
}
