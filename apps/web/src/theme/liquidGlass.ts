/**
 * Préférence « Liquid Glass » — réglage par appareil, comme le mode d'apparence.
 *
 * Même clé de stockage que le mobile (`tentacle_liquid_glass`), pour que le
 * vocabulaire reste identique d'une plateforme à l'autre.
 *
 * Défaut ACTIVÉ quand le moteur le supporte : c'est une fonctionnalité vitrine,
 * on l'offre en opt-out. Coupée, la surface retombe sur le flou enrichi
 * (liseré + spéculaire + saturation) — jamais sur une surface opaque nue.
 */

export const LIQUID_GLASS_STORAGE_KEY = "tentacle_liquid_glass";

const read = (): boolean => {
  try {
    const raw = localStorage.getItem(LIQUID_GLASS_STORAGE_KEY);
    return raw === null ? true : raw === "true";
  } catch {
    return true;
  }
};

let enabled = read();
const listeners = new Set<() => void>();

export const getLiquidGlass = (): boolean => enabled;

export function setLiquidGlass(next: boolean): void {
  enabled = next;
  try {
    localStorage.setItem(LIQUID_GLASS_STORAGE_KEY, String(next));
  } catch {
    /* Persistance impossible : vaut pour la session en cours. */
  }
  for (const l of listeners) l();
}

export function subscribeLiquidGlass(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
