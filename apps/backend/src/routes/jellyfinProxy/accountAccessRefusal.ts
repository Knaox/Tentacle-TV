import type { Response } from "undici";
import { accountAccessReply } from "../../services/accountAccess/accountAccessState";
import { blockedJellyfinToken } from "../../services/accountAccess/tokenOwners";
import type { AccountAccessRefusalBody } from "../../accountAccess/accountAccessContract";

/** Le refus d'un jeton d'APPAREIL (TV jumelée, profil) : son compte est connu. */
export { accountAccessRefusal as deviceAccessRefusal } from "../../services/accountAccess/accountAccessState";

/**
 * Un jeton JELLYFIN (web, bureau) passe le proxy tel quel : c'est Jellyfin qui le
 * refuse — 403 hors plage, 401 une fois le compte désactivé (il révoque ses
 * jetons). Le client recevait ce refus brut, et un 401 le déconnectait. Si le
 * compte de ce jeton est connu et BLOQUÉ, la réponse devient le refus de
 * Tentacle (`account_access`, 403) ; sinon elle passe telle quelle — un 403 du
 * proxy peut venir d'un droit manquant, il ne dit rien de l'accès.
 */
export async function personalTokenRefusal(token: string | null | undefined, response: Response): Promise<AccountAccessRefusalBody | null> {
  if (!token || (response.status !== 401 && response.status !== 403)) return null;
  const blocked = await blockedJellyfinToken(token, response.status, { identityCheck: false });
  if (!blocked) return null;
  // La réponse de Jellyfin n'est pas relayée : la connexion se libère.
  await response.body?.cancel().catch(() => undefined);
  return accountAccessReply(blocked.access);
}
