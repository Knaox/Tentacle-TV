import { hostInfo } from "../hostInfo";
import { primaryLanAddress } from "../../services/primaryLanAddress";

/**
 * L'adresse principale de la machine, hors conteneur seulement : celle d'un
 * conteneur ne vaut que sur le pont Docker. Elle remplace un navigateur en
 * `localhost` dans les adresses données aux appareils (`clientUrl.ts`,
 * `pairingAddress.ts`).
 */
export function hostLanAddress(): string | null {
  return hostInfo().containerized ? null : primaryLanAddress();
}
