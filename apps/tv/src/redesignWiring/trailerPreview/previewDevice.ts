import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { createTrailerPreviewArbiter, type TrailerPreviewArbiter } from "@tentacle-tv/shared";
import { createTrailerPreviewMemory, type TrailerPreviewMemory } from "@tentacle-tv/tv-core";

/**
 * Ce que l'aperçu tient pour TOUT l'appareil : un seul aperçu à la fois
 * (l'arbitre de shared), et la mémoire de la session — échecs de lecture et
 * reprise par vidéo (tv-core `createTrailerPreviewMemory`).
 */
export const previewArbiter: TrailerPreviewArbiter = createTrailerPreviewArbiter();
export const previewMemory: TrailerPreviewMemory = createTrailerPreviewMemory();

/** L'app est à l'écran : en arrière-plan (bouton TV, veille), aucun aperçu. */
export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setActive(state === "active"));
    return () => subscription.remove();
  }, []);
  return active;
}
