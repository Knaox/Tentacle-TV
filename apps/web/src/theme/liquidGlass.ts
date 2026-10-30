/**
 * Préférence « Liquid Glass » — réglage par appareil, comme le mode d'apparence.
 *
 * Même clé de stockage que le mobile (`tentacle_liquid_glass`), pour que le
 * vocabulaire reste identique d'une plateforme à l'autre.
 *
 * Défaut COUPÉ dans Tentacle (Damien, lot « fl » du 30/10 ; allumé jusque-là) :
 * le verre se choisit, Octave l'a d'office (`octaveAppearance.ts`). Seul
 * l'interrupteur écrit la clé : une valeur gardée est donc un choix de
 * l'utilisateur, et reste la sienne. Coupée, la surface retombe sur le rendu
 * d'avant.
 */

export const LIQUID_GLASS_STORAGE_KEY = "tentacle_liquid_glass";

const read = (): boolean => {
  try {
    const raw = localStorage.getItem(LIQUID_GLASS_STORAGE_KEY);
    return raw === "true";
  } catch {
    return false;
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
