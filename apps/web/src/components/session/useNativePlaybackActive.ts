import { useSyncExternalStore } from "react";

/**
 * Une lecture native est-elle en cours (`<html data-native-playback>`, posé par
 * `useTransparentPageDuringPlayback`) ? Sur la coquille macOS, la vidéo vit
 * alors dans une AUTRE fenêtre, sous la nôtre : une couche à alpha posée
 * par-dessus y laisse un artefact (cf. `SessionMessageHost`).
 */
function subscribe(onChange: () => void): () => void {
  if (typeof MutationObserver === "undefined" || typeof document === "undefined") return () => {};
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-native-playback"] });
  return () => observer.disconnect();
}

const read = (): boolean => typeof document !== "undefined" && document.documentElement.hasAttribute("data-native-playback");

export function useNativePlaybackActive(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
