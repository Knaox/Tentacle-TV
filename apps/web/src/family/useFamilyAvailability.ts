import { useAppConfig } from "@tentacle-tv/api-client";
import { isFamilyAvailable, type FamilyCapability } from "@tentacle-tv/shared";
import { useOfflineMode } from "../offline/useOfflineMode";
import { useActiveProfile } from "../auth/profileSession";

/** La Famille sur ce serveur, d'après `/api/config` › `features.family` : un
 *  serveur d'avant ne la déclare pas, et rien ne s'en montre alors.
 *  `settled` : la configuration a répondu (ou échoué) — avant, on ne conclut
 *  pas à l'absence (une arrivée directe sur la page ne doit pas en repartir).
 *  Bureau, session d'un PROFIL : aucune route de la Famille ne lui répond (le
 *  serveur les réserve à la session personnelle) — rien ne s'en montre. */
export function useFamilyAvailability(): { available: boolean; settled: boolean; capability: FamilyCapability | undefined } {
  const { data, isPending } = useAppConfig();
  const offline = useOfflineMode();
  const profileSession = useActiveProfile() !== null;
  const capability = data?.features.family;
  return { available: isFamilyAvailable(capability, offline) && !profileSession, settled: offline || profileSession || !isPending, capability };
}
