/**
 * « Qui regarde ? » à l'ouverture du BUREAU, absent du téléviseur.
 *
 * `App.tsx` consulte cette porte avant tout le reste ; sur le bureau elle peut
 * rendre le choix du profil plein écran. La TV LG n'a pas de profils de la
 * Famille (elle garde son jumelage) : la porte ne rend jamais rien, et tout
 * l'écran — `apps/web/src/profiles/`, que sa feuille ne balaie pas — quitte le
 * bundle.
 */
export function useProfileLaunchGate(_authed: boolean): null {
  return null;
}
