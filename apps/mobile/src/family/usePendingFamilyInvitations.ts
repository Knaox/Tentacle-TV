import { useFamilyOverview } from "@tentacle-tv/api-client";
import { answerableInvitations, pendingInvitationCount } from "@tentacle-tv/shared";
import { useFamilyAvailability } from "./useFamilyAvailability";

/**
 * Le badge de « Famille » dans Réglages › Compte : les invitations REÇUES qui
 * attendent une réponse (« Plus tard » comprises, jamais les échues — shared
 * `pendingInvitationCount`). 0 tant que rien n'est su, hors ligne, pendant une
 * session de profil (le serveur n'en rend qu'à la session personnelle) et face
 * à un serveur sans Famille. Même requête que l'affiche d'invitation : aucun
 * appel de plus.
 */
export function usePendingFamilyInvitations(): { count: number } {
  const { available } = useFamilyAvailability();
  const overview = useFamilyOverview({ enabled: available });
  return { count: available ? pendingInvitationCount(answerableInvitations(overview.data), Date.now()) : 0 };
}
