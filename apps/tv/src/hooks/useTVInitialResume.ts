import { useRef } from "react";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * Position de DÉMARRAGE du player (fragment #tnt-start lu par le natif) :
 * reprise initiale (UserData) ou position courante posée par un changement de
 * piste/qualité (startTicks).
 *
 * La reprise est SUIVIE depuis l'item TANT QUE la lecture n'a pas démarré
 * (`started`), puis FIGÉE. Avant démarrage on prend la valeur la plus FRAÎCHE :
 * un item venu du cache (page média-détail) peut être PÉRIMÉ puis rafraîchi —
 * sans ce suivi, on figeait la valeur périmée → reprise à une position
 * différente de celle lancée depuis l'accueil (qui, lui, fetch frais). Après
 * démarrage on fige : un refetch en cours de lecture porte la position COURANTE
 * (reportProgress) et ne doit PAS changer l'URL.
 */
export function useTVInitialResume(args: {
  item?: MediaItem | null;
  startTicks: number;
  /** Lecture réellement démarrée (1ʳᵉ position acceptée) → fige la reprise. */
  started?: boolean;
}) {
  const { item, startTicks, started } = args;

  const initialResumeSecondsRef = useRef<number | null>(null);
  if (!started && item) {
    initialResumeSecondsRef.current = (item.UserData?.PlaybackPositionTicks ?? 0) / TICKS_PER_SECOND;
  }
  const startSeconds = startTicks > 0
    ? startTicks / TICKS_PER_SECOND
    : (initialResumeSecondsRef.current ?? 0);

  return { initialResumeSecondsRef, startSeconds };
}
