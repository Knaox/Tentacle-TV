import { TRAILER_PREVIEW_TIMING, type TrailerPreviewMediaType, type TrailerPreviewSubject } from "@tentacle-tv/shared";
import type { TrailerPreviewHandle } from "@/trailerPreview/previewTypes";

/**
 * L'aperçu de bande-annonce au survol, éteint.
 *
 * Un téléviseur ne survole pas : la sélection, c'est le focus, et la Magic
 * Remote ne fait qu'y pointer. Et le décodage passe par la puce de la dalle —
 * hls.js n'y a pas sa place (`hls.js` y est déjà remplacé). Ce module remplace
 * l'index de `apps/web/src/trailerPreview/` ET sa liaison de racine : aucune
 * carte ne demande rien, aucune vidéo ne se monte, le moteur sort du bundle.
 */
export { TRAILER_PREVIEW_TIMING };
export type { TrailerPreviewPhase, TrailerPreviewSubject } from "@tentacle-tv/shared";
export type { TrailerPreviewHandle, TrailerPreviewStream, TrailerPreviewVideoProps } from "@/trailerPreview/previewTypes";

function nothing(): void {
  /* Pas d'aperçu sur un téléviseur. */
}

// Identités stables : la poignée part en props vers des composants mémoïsés.
const VIDEO_PROPS: TrailerPreviewHandle["videoProps"] = Object.freeze({
  stream: null, muted: true, playing: false, volume: 0, cycle: 0,
  onReady: nothing, onError: nothing, onEnded: nothing, onSoundBlocked: nothing,
});

const IDLE: TrailerPreviewHandle = Object.freeze({
  phase: "idle", mount: false, visible: false, playing: false, stream: null, muted: true,
  toggleMute: nothing, onReady: nothing, onError: nothing, onEnded: nothing, videoProps: VIDEO_PROPS,
});

export function previewSubjectOf(_item: unknown): TrailerPreviewSubject | null {
  return null;
}

export function previewSubjectOfTitle(_title: { mediaType: TrailerPreviewMediaType; tmdbId: number } | null | undefined): TrailerPreviewSubject | null {
  return null;
}

export function useTrailerPreview(_subject: TrailerPreviewSubject | null, _hovered: boolean): TrailerPreviewHandle {
  return IDLE;
}

export function TrailerPreviewVideo(): null {
  return null;
}

export function useTrailerPreviewsSetting(): [boolean, (next: boolean) => void] {
  return [false, nothing];
}

export function useTrailerPreviewMuted(): [boolean, (next: boolean) => void] {
  return [true, nothing];
}

/** La liaison de racine (`AppBindings`) : rien à lier. */
export function TrailerPreviewBinding(): null {
  return null;
}
