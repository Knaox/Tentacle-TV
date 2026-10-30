/**
 * L'apparence d'OCTAVE, réglée à part de celle de Tentacle, sur l'APPAREIL (Damien, 26/10) :
 *
 * - « Liquid Glass dans Octave » (`tentacle_octave_liquid_glass`) : ALLUMÉ d'office (lot « fl » du 30/10), quel
 *   que soit celui de Tentacle (coupé d'office). Une valeur déjà gardée reste la sienne — y compris celle que
 *   l'ancienne règle avait recopiée de Tentacle une fois : un « coupé » venait d'un choix de l'utilisateur ;
 * - « Apparence d'Octave » (`tentacle_octave_theme`) : `same` (comme Tentacle, le défaut), `light` ou `dark`.
 *
 * Lues par la porte du verre et par le thème quand Octave est affiché (`displayedSurface.ts`) ; aucune capacité
 * serveur. ⚠️ Clés traversées par une chaîne : jamais renommées.
 */

import { OCTAVE_LIQUID_GLASS_KEY, OCTAVE_THEME_KEY, sanitizeOctaveTheme, type OctaveTheme } from "@tentacle-tv/shared/octave";

// Clés et lecture partagées avec le mobile (`@tentacle-tv/shared/octave` › `octaveDeviceSettings.ts`).
export { OCTAVE_LIQUID_GLASS_KEY, OCTAVE_THEME_KEY, sanitizeOctaveTheme, type OctaveTheme };

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Le réglage d'Octave ; rien de gardé = allumé (rien n'est écrit tant que l'utilisateur ne choisit pas). */
function readOctaveLiquidGlass(): boolean {
  try {
    const own = storage()?.getItem(OCTAVE_LIQUID_GLASS_KEY) ?? null;
    return own === null ? true : own === "true";
  } catch {
    return true;
  }
}

let octaveGlass = readOctaveLiquidGlass();
let octaveTheme: OctaveTheme = sanitizeOctaveTheme(storage()?.getItem(OCTAVE_THEME_KEY));
const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};

function persist(key: string, value: string): void {
  try {
    storage()?.setItem(key, value);
  } catch {
    /* Persistance impossible : le choix vaut pour la session en cours. */
  }
}

export const getOctaveLiquidGlass = (): boolean => octaveGlass;
export const getOctaveTheme = (): OctaveTheme => octaveTheme;

export function setOctaveLiquidGlass(next: boolean): void {
  if (next === octaveGlass) return;
  octaveGlass = next;
  persist(OCTAVE_LIQUID_GLASS_KEY, String(next));
  emit();
}

export function setOctaveTheme(next: OctaveTheme): void {
  if (next === octaveTheme) return;
  octaveTheme = next;
  persist(OCTAVE_THEME_KEY, next);
  emit();
}

export function subscribeOctaveAppearance(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
