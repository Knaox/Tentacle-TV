/**
 * L'écran « Code PIN conseillé » du premier passage (Apple TV, Android TV) —
 * ce que l'écran décide ; l'adaptateur l'applique. La règle (pour qui, une
 * fois par profil, hors ligne) est celle de `session/pinSetup.ts`.
 *
 * - Deux gestes : « Créer un code PIN » (l'action principale) ouvre le pavé
 *   de son code (le même que Réglages › Compte) ; « Plus tard » marque
 *   l'étape et passe à la fenêtre suivante.
 * - Le focus entre sur « Créer un code PIN » — jamais sur « Plus tard », et
 *   il n'y a pas de croix : Retour vaut « Plus tard », jamais une impasse.
 * - L'écran paraît sous l'OK qui a ouvert le profil (sa tuile, le dernier
 *   chiffre de son code) : ses deux cibles portent la garde du clic fantôme.
 * - Le pavé ouvert depuis l'étape : Retour y ramène ; le code enregistré, la
 *   fenêtre suivante vient d'elle-même, après une brève confirmation.
 */

export const PIN_SETUP_CREATE_KEY = "pinSetup:create";
export const PIN_SETUP_LATER_KEY = "pinSetup:later";
/** Le pied des deux gestes. */
export const PIN_SETUP_ACTIONS_GROUP = "pinSetup:actions";

/** Le focus d'entrée, et celui du retour depuis le pavé : l'action principale. */
export const PIN_SETUP_ENTRY_KEY = PIN_SETUP_CREATE_KEY;

/** Les cibles gardées contre le clic fantôme. */
export function pinSetupGuardedKeys(): string[] {
  return [PIN_SETUP_CREATE_KEY, PIN_SETUP_LATER_KEY];
}

/** Retour, sur l'étape : « Plus tard ». */
export type PinSetupBackAction = "later";

export function pinSetupBackAction(): PinSetupBackAction {
  return "later";
}

/** Le temps de lire « Code PIN enregistré » sur le pavé, avant la fenêtre suivante (ms). */
export const PIN_SETUP_SAVED_HOLD_MS = 900;
