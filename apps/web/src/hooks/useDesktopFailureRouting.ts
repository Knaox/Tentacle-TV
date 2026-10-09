import { useEffect } from "react";
import type { PlaybackFailure } from "./playbackFailure";

/**
 * L'aiguillage d'un échec du lecteur de bureau — extrait de `DesktopPlayer`
 * (limite de 300 lignes par fichier), logique inchangée.
 *
 * La bascule de secours est un setState du PARENT : elle part d'un effet,
 * jamais du rendu — React tolérait l'appel en place mais l'interdit en mode
 * strict (« setState during render »). L'erreur de MÉDIA prend sa propre
 * porte : écran dédié chez le parent, mpv épargné.
 */
export function useDesktopFailureRouting(
  failure: PlaybackFailure | null,
  onMediaMissing: (() => void) | undefined,
  onFallbackToWeb: ((failure: PlaybackFailure) => void) | undefined,
): void {
  useEffect(() => {
    if (!failure) return;
    if (failure.kind === "media" && onMediaMissing) { onMediaMissing(); return; }
    if (onFallbackToWeb) onFallbackToWeb(failure);
  }, [failure, onFallbackToWeb, onMediaMissing]);
}
