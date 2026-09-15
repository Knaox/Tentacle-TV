import { useCallback, type MutableRefObject } from "react";
import type { MpvState } from "./mpvRuntime";
import { SEEK_END_EPS_S } from "./useSmartSeek";

/**
 * Les sauts du lecteur de bureau : ±10/30 s et « jusqu'au bout ».
 * Extrait de `DesktopPlayer` (limite de 300 lignes par fichier).
 */
export function useDesktopSkip({
  state, dur, effectiveMpvOffset, seek, seekRelative,
}: {
  state: MpvState;
  /** Durée affichée (film) — celle de Jellyfin si elle est connue. */
  dur: number;
  effectiveMpvOffset: MutableRefObject<number>;
  seek: (pos: number) => Promise<void>;
  seekRelative: (delta: number) => Promise<void>;
}): { seekToMpvEnd: () => void; skipRelativeOrEnd: (delta: number) => void } {
  // La FIN, en espace mpv : la durée de SON flux — l'offset de transcode ne
  // s'y applique pas. Avec `keep-open`, ce saut lève l'EOF réel de mpv
  // (`eof-reached`), et l'affiche de fin paraît : le geste manuel vaut l'EOF
  // naturel. Les cibles se comparent, elles, en POSITION FILM.
  const seekToMpvEnd = useCallback(() => {
    if (state.duration > 0) void seek(state.duration);
  }, [state.duration, seek]);

  // Un +30 s dont la cible atteint la fin — ou la dépasse — TERMINE la
  // lecture au lieu de se caler sur le bord. Un recul ne termine jamais.
  const skipRelativeOrEnd = useCallback((delta: number) => {
    const filmPos = state.position + effectiveMpvOffset.current;
    if (delta > 0 && dur > 0 && filmPos + delta >= dur - SEEK_END_EPS_S) {
      seekToMpvEnd();
      return;
    }
    void seekRelative(delta);
  }, [dur, state.position, effectiveMpvOffset, seekRelative, seekToMpvEnd]);

  return { seekToMpvEnd, skipRelativeOrEnd };
}
