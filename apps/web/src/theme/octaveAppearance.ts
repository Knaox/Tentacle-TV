/**
 * L'apparence d'OCTAVE, réglée à part de celle de Tentacle, sur l'APPAREIL (Damien, 26/10) :
 *
 * - « Liquid Glass dans Octave » (`tentacle_octave_liquid_glass`) : au premier lancement, la valeur de Tentacle
 *   (`tentacle_liquid_glass`, jamais renommée), recopiée une fois — puis indépendante dans les deux sens ;
 * - « Apparence d'Octave » (`tentacle_octave_theme`) : `same` (comme Tentacle, le défaut), `light` ou `dark`.
 *
 * Lues par la porte du verre et par le thème quand Octave est affiché (`displayedSurface.ts`) ; aucune capacité
 * serveur. ⚠️ Clés traversées par une chaîne : jamais renommées.
 */

import { LIQUID_GLASS_STORAGE_KEY } from "./liquidGlass";

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

/** Le réglage d'Octave ; absent, celui de Tentacle recopié (une fois) — le défaut de Tentacle est allumé. */
function readOctaveLiquidGlass(): boolean {
  const store = storage();
  try {
    const own = store?.getItem(OCTAVE_LIQUID_GLASS_KEY) ?? null;
    if (own !== null) return own === "true";
    const inherited = (store?.getItem(LIQUID_GLASS_STORAGE_KEY) ?? "true") === "true";
    store?.setItem(OCTAVE_LIQUID_GLASS_KEY, String(inherited));
    return inherited;
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
