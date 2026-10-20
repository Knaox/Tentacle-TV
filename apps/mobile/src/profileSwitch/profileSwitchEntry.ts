/**
 * L'adaptateur de « Changer de profil » en un geste (consigne de Damien du
 * 20/10 : toucher son nom propose aussitôt les autres profils). La puce de
 * l'en-tête (`ProfileChip`) ne connaît que ces deux points d'entrée ; la
 * bascule elle-même — la liste des profils, le code PIN, la session de
 * profil — appartient à la Famille mobile (`src/family/`).
 *
 * BOUCHONS tant que la branche de la Famille mobile n'est pas fusionnée : la
 * puce ne s'affiche jamais, l'en-tête garde son titre. Une fois fusionnée,
 * remplacer les corps par :
 *
 *   useProfileSwitchOffered → `useCanSwitchProfile()` (src/family/useCanSwitchProfile.ts)
 *   openProfileSwitcher     → l'ouverture de la feuille « Changer de profil »
 *                             (même écran que « Qui regarde ? », PIN compris)
 */

/** La puce a-t-elle un sens ici ? (famille de deux profils au moins, serveur qui sait, en ligne) */
export function useProfileSwitchOffered(): boolean {
  return false;
}

/** Ouvre la feuille « Changer de profil ». */
export function openProfileSwitcher(): void {
  // Bouchon : rien à ouvrir avant le branchement de la Famille mobile.
}
