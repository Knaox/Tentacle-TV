import { useActiveProfile } from "@/family/profiles/profileSessionState";
import { useCanSwitchProfile } from "@/family/useCanSwitchProfile";
import { usePendingFamilyInvitations } from "@/family/usePendingFamilyInvitations";

/**
 * Ce que les réglages lisent de la Famille du mobile — l'adaptateur, BRANCHÉ
 * sur les crochets de `src/family/` : `usePendingFamilyInvitations`
 * (invitations reçues en attente), `useCanSwitchProfile` (capacité du serveur
 * + au moins deux profils) et `useActiveProfile` (non nul = SESSION DE PROFIL).
 */

/** Le nombre d'invitations Famille reçues qui attendent une réponse (0 tant que rien n'est su). */
export function usePendingFamilyInvitationCount(): number {
  return usePendingFamilyInvitations().count;
}

/** « Changer de profil » a-t-il un sens ici ? */
export function useCanSwitchProfileFlag(): boolean {
  return useCanSwitchProfile();
}

/** L'app est-elle ouverte au nom d'un autre profil de la famille (session de profil) ? */
export function useIsProfileSession(): boolean {
  return useActiveProfile() !== null;
}
