/**
 * « Vous regardez encore ? » prend le coin bas-droit : la pilule de saut, la
 * pilule « épisode suivant » et la carte « à suivre » y vivent aussi, à la même
 * place. Tant que l'encart est là, elles s'effacent — deux surfaces empilées
 * dans le même coin ne se lisent ni l'une ni l'autre.
 *
 * L'affiche PLEINE de fin, elle, reste : elle couvre l'écran entier, l'encart
 * se pose par-dessus, et elle porte seule l'enchaînement qu'elle annonce.
 *
 * Seul le RENDU s'efface : l'arbitre continue de décider (un saut automatique
 * part à son heure, comme il partirait sous un panneau ouvert).
 */

import type { PlayerOverlay } from "@tentacle-tv/shared";
import type { StillWatchingController } from "@tentacle-tv/api-client";

const NONE: PlayerOverlay = { kind: "none" };

export function overlayBesideStillWatching(
  overlay: PlayerOverlay,
  phase: StillWatchingController["phase"] | undefined,
): PlayerOverlay {
  if (phase === undefined || phase === "none") return overlay;
  if (overlay.kind === "nextCard" && overlay.final) return overlay;
  return overlay.kind === "none" ? overlay : NONE;
}
