/**
 * Le clavier du lecteur des bandes-annonces — une table pure, testée seule.
 *
 * Les touches de YouTube et du lecteur du bureau : Espace ou K (lecture),
 * ← / J et → / L (−10 / +10 s), ↑ ↓ (volume), M (muet), F (plein écran),
 * C (sous-titres), Maj+N / Maj+P (bande-annonce suivante / précédente),
 * Échap (sortir du plein écran, sinon fermer le lecteur — jamais la fiche).
 * Un raccourci du système (Ctrl, Cmd, Alt) n'est jamais pris.
 */

export const TRAILER_SKIP_S = 10;
export const TRAILER_VOLUME_STEP = 0.1;

export type TrailerKeyAction =
  | { kind: "togglePlay" }
  | { kind: "skip"; delta: number }
  | { kind: "volume"; delta: number }
  | { kind: "toggleMute" }
  | { kind: "toggleFullscreen" }
  | { kind: "toggleSubtitles" }
  | { kind: "neighbor"; direction: 1 | -1 }
  | { kind: "escape" };

export interface TrailerKey {
  code: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

export function trailerKeyAction(key: TrailerKey): TrailerKeyAction | null {
  if (key.ctrlKey || key.metaKey || key.altKey) return null;
  if (key.shiftKey) {
    if (key.code === "KeyN") return { kind: "neighbor", direction: 1 };
    if (key.code === "KeyP") return { kind: "neighbor", direction: -1 };
    return null;
  }
  switch (key.code) {
    case "Space":
    case "KeyK":
      return { kind: "togglePlay" };
    case "ArrowLeft":
    case "KeyJ":
      return { kind: "skip", delta: -TRAILER_SKIP_S };
    case "ArrowRight":
    case "KeyL":
      return { kind: "skip", delta: TRAILER_SKIP_S };
    case "ArrowUp":
      return { kind: "volume", delta: TRAILER_VOLUME_STEP };
    case "ArrowDown":
      return { kind: "volume", delta: -TRAILER_VOLUME_STEP };
    case "KeyM":
      return { kind: "toggleMute" };
    case "KeyF":
      return { kind: "toggleFullscreen" };
    case "KeyC":
      return { kind: "toggleSubtitles" };
    case "Escape":
      return { kind: "escape" };
    default:
      return null;
  }
}

/** Le volume après un appui sur ↑ ou ↓, borné à [0, 1], au centième. */
export function steppedVolume(volume: number, delta: number): number {
  return Math.round(Math.min(1, Math.max(0, volume + delta)) * 100) / 100;
}
