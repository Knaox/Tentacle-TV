import type { Response } from "undici";
import { accountAccessReply } from "../../services/accountAccess/accountAccessState";
import { blockedJellyfinToken } from "../../services/accountAccess/tokenOwners";
import { loginRefusal } from "../../services/accountAccess/connectRefusal";
import type { AccountAccessRefusalBody, AccountConnectRefusalBody } from "../../accountAccess/accountAccessContract";

/** Le refus d'un jeton d'APPAREIL (TV jumelée, profil) : son compte est connu. */
export { accountAccessRefusal as deviceAccessRefusal } from "../../services/accountAccess/accountAccessState";

/**
 * Ce que Jellyfin vient de REFUSER par le proxy, redit par Tentacle (§ 9.1) :
 * - la connexion du bureau (`Users/AuthenticateByName`) : 403 sans raison chez
 *   Jellyfin → la raison en mots (désactivé, bloqué, hors plage, trop de sessions) ;
 * - un jeton JELLYFIN (web, bureau) qui passe le proxy tel quel : 403 hors plage,
 *   401 une fois le compte désactivé (Jellyfin révoque ses jetons) — si son compte
 *   est connu et BLOQUÉ, le refus de Tentacle (`account_access`, 403), qui ne
 *   déconnecte pas. Sinon la réponse passe telle quelle : un 403 du proxy peut
 *   venir d'un droit manquant, il ne dit rien de l'accès.
 */
export async function proxiedRefusal(
  request: { token: string | null | undefined; path: string; body: unknown },
  response: Response,
): Promise<AccountAccessRefusalBody | AccountConnectRefusalBody | null> {
  if (response.status !== 401 && response.status !== 403) return null;
  const refusal = /^Users\/AuthenticateByName$/i.test(request.path)
    ? response.status === 403 ? await loginRefusal(usernameOf(request.body)) : null
    : await tokenRefusal(request.token, response.status);
  // La réponse de Jellyfin n'est pas relayée : la connexion se libère.
  if (refusal) await response.body?.cancel().catch(() => undefined);
  return refusal;
}

async function tokenRefusal(token: string | null | undefined, status: number): Promise<AccountAccessRefusalBody | null> {
  if (!token) return null;
  const blocked = await blockedJellyfinToken(token, status, { identityCheck: false });
  return blocked ? accountAccessReply(blocked.access) : null;
}

function usernameOf(body: unknown): string {
  let parsed = body;
  if (typeof body === "string" || Buffer.isBuffer(body)) {
    try {
      parsed = JSON.parse(String(body));
    } catch {
      return "";
    }
  }
  const name = (parsed as { Username?: unknown } | null)?.Username;
  return typeof name === "string" ? name : "";
}
