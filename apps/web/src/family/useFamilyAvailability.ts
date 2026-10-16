import { useAppConfig, useServerCapability } from "@tentacle-tv/api-client";
import { isFamilyAvailable, type FamilyCapability } from "@tentacle-tv/shared";
import { useOfflineMode } from "../offline/useOfflineMode";
import { useActiveProfile, type ActiveProfile } from "../auth/profileSession";

/** La Famille sur ce serveur, d'après `/api/config` › `features.family` : un
 *  serveur d'avant ne la déclare pas, et rien ne s'en montre alors.
 *  `settled` : la configuration a répondu (ou échoué) — avant, on ne conclut
 *  pas à l'absence (une arrivée directe sur la page ne doit pas en repartir).
 *  Ce qui est PERSONNEL (invitation reçue, son code PIN, rappels) : la session
 *  personnelle seulement — une session de PROFIL du bureau n'en montre rien.
 *  La page de la Famille, elle, suit `useFamilySettingsAvailability`. */
export function useFamilyAvailability(): { available: boolean; settled: boolean; capability: FamilyCapability | undefined } {
  const { data, isPending } = useAppConfig();
  const offline = useOfflineMode();
  const profileSession = useActiveProfile() !== null;
  const capability = data?.features.family;
  return { available: isFamilyAvailable(capability, offline) && !profileSession, settled: offline || profileSession || !isPending, capability };
}

/** Une session de profil peut-elle gérer la famille ? Le propriétaire ou un membre, sur un
 *  serveur qui le sait (`family.profileManage`) — jamais un invité. Le reste (son code PIN,
 *  le déverrouillage, ses droits), le serveur le dit à la page. */
export function profileMayManage(profile: Pick<ActiveProfile, "kind"> | null, profileManage: boolean): boolean {
  return profile !== null && profileManage && profile.kind !== "guest";
}

/**
 * Réglages › Famille : la session personnelle, ou (bureau, 1.30.0) la session d'un PROFIL qui
 * peut gérer (`profileMayManage`) — avec SES droits, derrière SON code, jamais en basculant sur
 * le compte de l'appareil. `managing` : c'est le second cas.
 */
export function useFamilySettingsAvailability(): { available: boolean; settled: boolean; managing: boolean } {
  const { data, isPending } = useAppConfig();
  const offline = useOfflineMode();
  const profile = useActiveProfile();
  const profileManage = useServerCapability("family.profileManage");
  const family = isFamilyAvailable(data?.features.family, offline);
  const settled = offline || !isPending;
  if (profile === null) return { available: family, settled, managing: false };
  const managing = family && profileMayManage(profile, profileManage);
  return { available: managing, settled, managing };
}
