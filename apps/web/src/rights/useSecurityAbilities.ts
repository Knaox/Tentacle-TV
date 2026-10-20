import { mayShow, useAccountAbilities } from "@tentacle-tv/api-client";
import { isDesktopApp } from "../desktop/detect";

/**
 * Réglages › Sécurité, d'après ce que le serveur dit des droits de la SESSION
 * (`account.abilities`, relu à `rights:changed`) : le mot de passe
 * (`manageAccount`), les appareils jumelés (`pairDevices`) ; le changement de
 * serveur (bureau) reste, il ne touche à aucun droit. `any` : la section existe ;
 * `pending` : la réponse n'est pas encore là (ni section, ni redirection).
 */
export function useSecurityAbilities(): { password: boolean; devices: boolean; any: boolean; pending: boolean } {
  const abilities = useAccountAbilities();
  const password = mayShow(abilities, "manageAccount");
  const devices = mayShow(abilities, "pairDevices");
  return { password, devices, any: password || devices || isDesktopApp(), pending: abilities.kind === "pending" };
}
