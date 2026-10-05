import { useMemo } from "react";
import type { AmbientSource } from "../../redesign/background/ambientSource";
import type { ArtworkPalette } from "../../redesign/color/artworkPalette";

/**
 * La lumière de la carte focalisée d'un écran (`AmbientSource`), posée par
 * l'écran câblé SANS se redessiner : le fond vivant de la vue la suit seul.
 */
export interface AmbientStore extends AmbientSource {
  /** La lumière qui s'impose ; `null` : celle de la vue (héros, première carte). */
  set(palette: ArtworkPalette | null): void;
}

export function createAmbientStore(): AmbientStore {
  let current: ArtworkPalette | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set(palette) {
      if (palette === current) return;
      current = palette;
      for (const listener of listeners) listener();
    },
  };
}

/** Une source de lumière pour l'écran, stable le temps de son montage. */
export function useAmbientStore(): AmbientStore {
  return useMemo(createAmbientStore, []);
}
