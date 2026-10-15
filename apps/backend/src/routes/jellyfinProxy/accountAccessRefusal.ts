import type { Response } from "undici";
import { accountAccessReply } from "../../services/accountAccess/accountAccessState";
import { blockedJellyfinToken } from "../../services/accountAccess/tokenOwners";
import { lockedOutRefusal, loginRefusal } from "../../services/accountAccess/connectRefusal";
import { afterPasswordLogin, beforePasswordLogin } from "../../services/accountAccess/loginLockout";
import type { AccountAccessRefusalBody, AccountConnectRefusalBody } from "../../accountAccess/accountAccessContract";

/** Le refus d'un jeton d'APPAREIL (TV jumelée, profil) : son compte est connu. */
export { accountAccessRefusal as deviceAccessRefusal } from "../../services/accountAccess/accountAccessState";

const LOGIN_PATH = /^Users\/AuthenticateByName$/i;

/** La connexion par mot de passe du bureau (et du mobile), relayée par le proxy. */
export interface ProxiedLogin {
  username: string;
}

/**
 * Avant de relayer une connexion : un compte actif au compteur d'essais resté
 * plein repart de 0 (cf. `loginLockout`) — sinon le premier échec le rebloquerait.
 */
export async function proxiedLogin(path: string, body: unknown): Promise<ProxiedLogin | null> {
  if (!LOGIN_PATH.test(path)) return null;
  const username = usernameOf(body);
  if (username) await beforePasswordLogin(username).catch(() => undefined);
  return { username };
}

/**
 * Ce que Jellyfin vient de répondre par le proxy, redit par Tentacle (§ 9.1) :
 * - la connexion du bureau : un mot de passe faux qui atteint la limite bloque le
 *   compte (Jellyfin 10.11 ne le fait pas) ; un 403 sans raison chez Jellyfin →
 *   la raison en mots (désactivé, bloqué, hors plage, trop de sessions) ; une
 *   réussite remet le compteur à 0 ;
 * - un jeton JELLYFIN (web, bureau) qui passe le proxy tel quel : 403 hors plage,
 *   401 une fois le compte désactivé (Jellyfin révoque ses jetons) — si son compte
 *   est connu et BLOQUÉ, le refus de Tentacle (`account_access`, 403), qui ne
 *   déconnecte pas. Sinon la réponse passe telle quelle : un 403 du proxy peut
 *   venir d'un droit manquant, il ne dit rien de l'accès.
 */
export async function proxiedRefusal(
  token: string | null | undefined,
  login: ProxiedLogin | null,
  response: Response,
): Promise<AccountAccessRefusalBody | AccountConnectRefusalBody | null> {
  if (login?.username && response.ok) void afterPasswordLogin(login.username, true).catch(() => undefined);
  if (response.status !== 401 && response.status !== 403) return null;
  const refusal = login ? await loginOutcome(login.username, response.status) : await tokenRefusal(token, response.status);
  // La réponse de Jellyfin n'est pas relayée : la connexion se libère.
  if (refusal) await response.body?.cancel().catch(() => undefined);
  return refusal;
}

async function loginOutcome(username: string, status: number): Promise<AccountConnectRefusalBody | null> {
  if (!username) return null;
  if (status === 403) return loginRefusal(username);
  return (await afterPasswordLogin(username, false).catch(() => null)) === "lockedOut" ? lockedOutRefusal() : null;
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
