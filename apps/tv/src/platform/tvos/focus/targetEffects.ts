import type { FocusForm } from "../../../redesign/focus/focusBinding";
import { parallaxOf } from "../../../redesignWiring/remote/parallax";

/**
 * Les effets natifs du focus d'une CIBLE (`FocusTarget`), selon sa forme —
 * posés d'office par le magasin (`focusStore.ts`), avant les props propres à
 * une clé (verrous, préférences), qui l'emportent. Apple TV : la parallaxe au
 * pouce (`remote/parallax.ts`). Android TV a sa variante
 * (`targetEffects.android.ts`).
 */
export function targetEffects(form: FocusForm | undefined): Readonly<Record<string, unknown>> | undefined {
  return parallaxOf(form);
}

/** Ce qu'une cible désactivée porte en plus : rien — tvOS ne focalise pas une `Pressable` désactivée. */
export const DISABLED_TARGET: Readonly<Record<string, unknown>> | undefined = undefined;
