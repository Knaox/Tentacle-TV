import { useFamilyOverview } from "@tentacle-tv/api-client";
import { familyEntryShown } from "@tentacle-tv/shared";
import { useActiveProfile } from "@/family/profiles/profileSessionState";
import { useFamilyAvailability } from "@/family/useFamilyAvailability";
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

/**
 * L'entrée « Famille » a-t-elle quelque chose à montrer à ce compte (shared `familyEntryShown`) ?
 * Une famille, une invitation reçue, ou une famille qu'il peut fonder : un droit coupé par
 * l'administration n'y laisse rien. Même requête que l'affiche d'invitation ; relue en direct
 * (`family:update`). Rien tant qu'elle n'a pas répondu ; en échec, l'entrée reste (la page dit
 * l'erreur et propose de réessayer).
 */
export function useFamilyEntryShown(): boolean {
  const { available } = useFamilyAvailability();
  const overview = useFamilyOverview({ enabled: available });
  if (overview.isError) return true;
  return familyEntryShown(overview.data, Date.now()) === true;
}
