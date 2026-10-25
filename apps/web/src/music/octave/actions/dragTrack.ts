/**
 * Octave — le titre qu'on GLISSE (bureau et web, souris) vers une playlist du rail. Le glisser ne transporte que
 * des chaînes : le titre lui-même reste ici le temps du geste. Le menu du titre reste l'équivalent au clavier.
 */

import type { MusicTrack } from "@tentacle-tv/shared/music";

/** Le type porté par le glisser : une playlist du rail ne réagit qu'à lui. */
export const TRACK_DRAG_TYPE = "application/x-octave-track";

let dragged: MusicTrack | null = null;

export function startTrackDrag(event: { dataTransfer: DataTransfer | null }, track: MusicTrack): void {
  dragged = track;
  event.dataTransfer?.setData(TRACK_DRAG_TYPE, track.key);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
}

export function endTrackDrag(): void {
  dragged = null;
}

/** Le titre glissé, si le geste porte bien un titre d'Octave. */
export function draggedTrack(event: { dataTransfer: DataTransfer | null }): MusicTrack | null {
  const key = event.dataTransfer?.getData(TRACK_DRAG_TYPE);
  return dragged && (!key || key === dragged.key) ? dragged : null;
}

export const carriesTrack = (event: { dataTransfer: DataTransfer | null }): boolean => !!event.dataTransfer?.types.includes(TRACK_DRAG_TYPE);
