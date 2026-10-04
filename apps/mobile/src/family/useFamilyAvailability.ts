import { useAppConfig } from "@tentacle-tv/api-client";
import { isFamilyAvailable, type FamilyCapability } from "@tentacle-tv/shared";
import { useStoredUser } from "@/auth/useStoredUser";
import { useOfflineMode } from "@/offline/useOfflineMode";

/**
 * La Famille sur ce serveur, d'après `/api/config` › `features.family` : un
 * serveur d'avant ne la déclare pas, et rien ne s'en montre alors — ni entrée
 * du profil, ni affiche, ni requête. Hors ligne ou sans session : rien non
 * plus. `settled` : la configuration a répondu (ou échoué) ; avant, on ne
 * conclut pas à l'absence (un lien profond vers la page ne doit pas en
 * repartir).
 *
 * Les familles coupées par l'administrateur laissent la page : on peut
 * encore quitter, retirer, supprimer un invité ou dissoudre.
 */
export function useFamilyAvailability(): { available: boolean; settled: boolean; capability: FamilyCapability | undefined } {
  const { data, isPending } = useAppConfig();
  const offline = useOfflineMode();
  const signedIn = useStoredUser() !== null;
  const capability = data?.features.family;
  return {
    available: signedIn && isFamilyAvailable(capability, offline),
    settled: offline || !signedIn || !isPending,
    capability,
  };
}
