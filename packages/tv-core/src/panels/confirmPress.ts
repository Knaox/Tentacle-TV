/**
 * La CONFIRMATION À DOUBLE APPUI d'une action qui fait sortir du compte —
 * « Déjumeler cet appareil » (voile hors ligne, compte des réglages),
 * « Changer de serveur » : le premier OK ARME (le libellé devient
 * « Confirmer — … » et une ligne dit ce qui va se passer), le second, toujours
 * sur le même bouton, EXÉCUTE et désarme ; quitter le bouton désarme. Pas de
 * boîte de dialogue : à la télécommande, il faudrait y retrouver le bouton
 * d'annulation.
 *
 * L'état armé est un état d'AFFICHAGE, tenu par l'écran (une action à la
 * fois) ; ces deux fonctions disent comment il change.
 */

export interface ConfirmStep<A> {
  /** L'action armée après l'appui ; `null` : rien. */
  armed: A | null;
  /** L'appui exécute l'action. */
  run: boolean;
}

/** OK sur le bouton de `action`. */
export function confirmPress<A>(armed: A | null, action: A): ConfirmStep<A> {
  return armed === action ? { armed: null, run: true } : { armed: action, run: false };
}

/** Le bouton de `action` perd le focus : il désarme, s'il était armé. */
export function confirmBlur<A>(armed: A | null, action: A): A | null {
  return armed === action ? null : armed;
}
