/**
 * Ce que les réglages lisent de la Famille du mobile — l'ADAPTATEUR vers les
 * crochets de la session « famille-mobile » (lot du 2026-10-20) :
 * `usePendingFamilyInvitations` (invitations reçues en attente) et
 * `useCanSwitchProfile` (capacité du serveur + au moins deux profils) et
 * `useActiveProfile` (non nul = SESSION DE PROFIL), dans `src/family/`. Tant qu'ils ne sont pas fusionnés, ce module répond « rien »
 * : pas de badge, pas de « Changer de profil » — jamais une erreur.
 */

/** Le nombre d'invitations Famille reçues qui attendent une réponse (0 tant que rien n'est su). */
export function usePendingFamilyInvitationCount(): number {
  return 0;
}

/** « Changer de profil » a-t-il un sens ici ? */
export function useCanSwitchProfileFlag(): boolean {
  return false;
}

/** L'app est-elle ouverte au nom d'un autre profil de la famille (session de profil) ? */
export function useIsProfileSession(): boolean {
  return false;
}
