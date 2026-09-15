import { useRef } from "react";
import type { MpvState } from "./mpvRuntime";
import { useMpvPrebuffer } from "./useMpvPrebuffer";

/**
 * L'écran de chargement du lecteur de bureau : quand le montrer, et la réserve
 * constituée avant de lancer l'image. Extrait de `DesktopPlayer` (limite de
 * 300 lignes par fichier) ; `prebuffering` est aussi lu par le transport
 * Watch Together — un lecteur qui remplit sa réserve n'est pas « prêt ».
 */
export function useDesktopLoadingOverlay({
  state, mediaReady, sourceChanging, hasStarted, setPause,
}: {
  state: MpvState;
  mediaReady: boolean;
  sourceChanging: boolean;
  hasStarted: boolean;
  setPause: (paused: boolean) => Promise<void>;
}): { prebuffering: boolean; showLoadingOverlay: boolean } {
  // Show loading overlay: initial load OR source change (quality/audio switch).
  // Sécurité anti-spinner-éternel : mpv qui lit sans le dire (event "playing"
  // perdu — configs Windows + EAC3 5.1). Le signe, c'est une position qui
  // AVANCE : `position > 0` ne le prouve pas, time-pos valant déjà la position
  // de départ dès l'ouverture du fichier sur une REPRISE.
  const startPosRef = useRef<number | null>(null);
  if (startPosRef.current === null && state.position > 0) startPosRef.current = state.position;
  const playbackStarted = startPosRef.current !== null && state.position > startPosRef.current + 0.25;
  // Réserve constituée avant de lancer l'image, l'écran de chargement couvrant
  // l'attente : un seul chargement, et il ne recommence pas derrière.
  const prebuffering = useMpvPrebuffer({ mediaReady, buffered: state.buffered, eof: state.eof, setPause });
  const showLoadingOverlay = prebuffering || (playbackStarted
    ? false
    : sourceChanging || (!state.playing && !hasStarted));
  return { prebuffering, showLoadingOverlay };
}
