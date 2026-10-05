import type { FocusForm } from "../../../redesign/focus/focusBinding";

/**
 * Android TV — les effets natifs du focus d'une cible (`FocusTarget`) : pas de
 * parallaxe, mais `tvFocusable: true` POSÉ. Sur Android, une prop qui
 * disparaît reprend sa valeur par défaut — `false` pour `tvFocusable`
 * (`ReactViewManager.setTvFocusable`) : une cible verrouillée
 * (`focusLocks.ts`, `tvFocusable: false`) puis libérée (sa liaison retirée)
 * serait restée infocalisable pour toujours — les choix d'un panneau après
 * `useChoiceEntry`, la croix du lecteur après son verrou. Toujours posée, la
 * valeur revient à `true` ; un verrou, posé par-dessus, l'emporte.
 */
const RELEASED: Readonly<Record<string, unknown>> = Object.freeze({ tvFocusable: true });

export function targetEffects(form: FocusForm | undefined): Readonly<Record<string, unknown>> | undefined {
  return form === "section" ? undefined : RELEASED;
}
