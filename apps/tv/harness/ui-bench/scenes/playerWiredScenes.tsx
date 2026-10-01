import { useCallback, useEffect, useMemo } from "react";
import { FocusBindingProvider, type FocusBinder } from "../../../src/redesign/focus/focusBinding";
import { useFocusStore } from "../../../src/redesignWiring/focus/focusStore";
import { END_EXIT_LOCK, useEndExitLocked } from "../../../src/redesignWiring/player/endExitLock";
import {
  PLAYER_GROUP_CONTAINERS,
  PlayerFocusStateProvider,
  type PlayerFocusState,
} from "../../../src/redesignWiring/player/playerFocusContainers";
import type { BenchData } from "../data/benchData";
import { PLAYER_SCENES } from "./playerScenes";
import type { BenchScene } from "./types";

/**
 * Le lecteur CÂBLÉ, en focus natif : une scène du lecteur sous les guides de
 * l'intégration (`PLAYER_GROUP_CONTAINERS`) et le magasin de focus, l'entrée
 * réclamée comme dans l'app — ce que la télécommande éprouve sans lancer de
 * lecture (l'affiche de fin n'arrive qu'au bout d'un épisode, et la regarder
 * pour de vrai le marquerait vu sur le compte de test).
 *
 * Pas de figeage : les clés `focusKeys` restent vides, le focus est celui de
 * tvOS. D'une scène câblée à l'autre, passer par le catalogue (`menu`).
 */

function WiredPlayer({ data, sourceId, entry }: { data: BenchData; sourceId: string; entry: string }) {
  const store = useFocusStore();
  const state = useMemo<PlayerFocusState>(() => ({ store, islandTrap: false, islandExit: false, activeSeasonIndex: 0 }), [store]);
  // Le verrou de la croix de fin, celui du lecteur (`usePlayerFocus`).
  const endExitLocked = useEndExitLocked(store, entry === "end:play");
  const bind = useCallback<FocusBinder>(
    (key) => {
      const container = PLAYER_GROUP_CONTAINERS[key];
      if (container) return { container };
      const binding = store.binder(key);
      if (key === "end:leave" && endExitLocked) return { ...binding, ...END_EXIT_LOCK };
      return key === entry ? { ...binding, native: { hasTVPreferredFocus: true } } : binding;
    },
    [store, entry, endExitLocked],
  );
  // L'entrée réclamée à l'apparition, comme `useClaimOnRise` du lecteur.
  useEffect(() => store.claim(entry), [store, entry]);
  const source = PLAYER_SCENES.find((scene) => scene.id === sourceId);
  return (
    <FocusBindingProvider bind={bind}>
      <PlayerFocusStateProvider value={state}>{source ? source.render(data) : <></>}</PlayerFocusStateProvider>
    </FocusBindingProvider>
  );
}

function wired(id: string, label: string, sourceId: string, entry: string): BenchScene {
  const source = PLAYER_SCENES.find((scene) => scene.id === sourceId);
  return {
    id: `retour/${id}`,
    group: "Retour",
    label,
    settleMs: source?.settleMs ?? 1400,
    images: source?.images,
    render: (data) => <WiredPlayer data={data} sourceId={sourceId} entry={entry} />,
  };
}

export const PLAYER_WIRED_SCENES: BenchScene[] = [
  wired("fin-cablee", "Câblée (focus natif) — affiche de fin : entrée « Lire maintenant », HAUT → croix", "lecteur/fin", "end:play"),
  wired("ouverture-cablee", "Câblée (focus natif) — ouverture : la croix seule, piégée", "lecteur/resolution", "loading:back"),
];
