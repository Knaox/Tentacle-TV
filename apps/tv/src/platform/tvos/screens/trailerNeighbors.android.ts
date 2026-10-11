import { trailerNeighbor, type Direction, type TrailerFocusView } from "@tentacle-tv/tv-core";
import type { FocusStore } from "../focus/focusStore";

/**
 * Android TV — les voisins de la bande-annonce (tv-core `trailerNeighbor`)
 * posés en `nextFocus*` sur la cible focalisée : « rester » la vise
 * elle-même — ←/→ sur la barre appartiennent à la vidéo. Le pendant tvOS
 * (`trailerNeighbors.ts`) passe par les ponts.
 */

const NEIGHBOR_PROPS: ReadonlyArray<readonly [Direction, string]> = [
  ["haut", "nextFocusUp"],
  ["bas", "nextFocusDown"],
  ["gauche", "nextFocusLeft"],
  ["droite", "nextFocusRight"],
];

type Settable = { setNativeProps?: (props: object) => void };

export function applyTrailerNeighbors(store: FocusStore, key: string, view: TrailerFocusView, lastTool: string | null): void {
  const node = store.node(key) as Settable | null;
  if (!node) return;
  const props: Record<string, number | null> = {};
  for (const [direction, prop] of NEIGHBOR_PROPS) {
    const target = trailerNeighbor(key, direction, view, lastTool);
    props[prop] = store.handle(target === "stay" ? key : target);
  }
  node.setNativeProps?.(props);
}
