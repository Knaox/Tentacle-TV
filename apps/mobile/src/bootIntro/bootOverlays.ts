import { useEffect, useState, useSyncExternalStore } from "react";
import { bootIntroGate } from "@tentacle-tv/brand-intro-native";
import type { BootFirstScreenOverlay } from "./bootIntroRules";

/**
 * Les recouvrements du premier écran RÉELLEMENT montés dans l'écran du poulpe
 * (« Qui regarde ? », le premier lancement, la migration, l'accès suspendu) :
 * l'ouverture ne plonge dans l'un d'eux qu'une fois sa vue à l'écran — jamais
 * sur la foi d'un hôte qui a décidé de le montrer plus tard (le premier
 * lancement attend son calme). Un magasin à part : les hôtes ne connaissent
 * pas l'ouverture, seulement `BootAwareModal`.
 */
let shown: ReadonlySet<BootFirstScreenOverlay> = new Set();
const listeners = new Set<() => void>();

function setShown(overlay: BootFirstScreenOverlay, on: boolean): void {
  if (shown.has(overlay) === on) return;
  const next = new Set(shown);
  if (on) next.add(overlay);
  else next.delete(overlay);
  shown = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = (): ReadonlySet<BootFirstScreenOverlay> => shown;

export function useShownBootOverlays(): ReadonlySet<BootFirstScreenOverlay> {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/**
 * Vrai si cette surface est née PENDANT l'ouverture : elle vit alors dans
 * l'arbre de l'app (dans l'écran du poulpe) pour toute sa vie — une `Modal`
 * ou une `FullWindowOverlay` est une fenêtre native posée par-dessus
 * l'ouverture, et basculer de l'une à l'autre la remonterait sous les yeux.
 * Elle se déclare montrée tant qu'elle est montée.
 */
export function useBornInBootIntro(overlay: BootFirstScreenOverlay | undefined): boolean {
  const [inTree] = useState(() => bootIntroGate.snapshot().playing);
  useEffect(() => {
    if (!inTree || !overlay) return undefined;
    setShown(overlay, true);
    return () => setShown(overlay, false);
  }, [inTree, overlay]);
  return inTree;
}
