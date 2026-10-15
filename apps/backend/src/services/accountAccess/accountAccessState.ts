/**
 * L'ACCÈS d'un compte aux portes du serveur (docs/DROITS-UTILISATEURS.md § 9.1) :
 * désactivé ou hors de ses plages horaires, un compte ne se sert plus de Tentacle,
 * par AUCUNE porte — même ce que Tentacle lui sert avec la clé d'administration
 * (TV jumelée, profils, recherche, recommandations), que Jellyfin ne juge jamais.
 *
 * Jellyfin fait foi : `IsDisabled` et `AccessSchedules` de la politique du compte,
 * lus par le socle (`getContentPolicy` : 30 s au plus, vidé à l'écriture). La règle
 * est celle du contrat (`accountAccessOf`), à l'heure LOCALE du serveur. Elle vaut
 * pour tous, administrateurs compris ; seul « voir en tant que » n'est pas borné :
 * c'est l'administrateur qui regarde, pas le compte.
 */

import { getContentPolicy, type ContentPolicy } from "../contentPolicy";
import { accountAccessOf, type AccountAccessPolicy } from "../../accountAccess/accountAccessRule";
import {
  ACCOUNT_ACCESS_ERROR,
  type AccountAccessBlocked,
  type AccountAccessRefusalBody,
  type AccountAccessState,
} from "../../accountAccess/accountAccessContract";

/** Ce que la politique de contenu dit de l'accès (champs absents : rien à juger). */
export function accessPolicyOf(policy: Partial<ContentPolicy>): AccountAccessPolicy {
  return {
    readable: policy.readable === true,
    isDisabled: policy.isDisabled === true,
    accessSchedules: policy.accessSchedules ?? [],
    invalidLoginAttemptCount: policy.invalidLoginAttemptCount,
    loginAttemptsBeforeLockout: policy.loginAttemptsBeforeLockout,
  };
}

/** L'état d'accès d'un compte, maintenant. Jellyfin muet : permis. */
export async function accountAccessFor(userId: string, now = Date.now()): Promise<AccountAccessState> {
  return accountAccessOf(accessPolicyOf(await getContentPolicy(userId)), now);
}

/** Le corps du refus d'une porte : 403, jamais 401 (le client ne se déconnecte pas). */
export function accountAccessReply(access: AccountAccessBlocked): AccountAccessRefusalBody {
  return { error: ACCOUNT_ACCESS_ERROR, ...access };
}

/** Le refus d'une porte pour ce compte — ou null s'il peut passer. */
export async function accountAccessRefusal(userId: string): Promise<AccountAccessRefusalBody | null> {
  const access = await accountAccessFor(userId);
  return access.state === "allowed" ? null : accountAccessReply(access);
}

/** Le refus pour l'utilisateur d'une session ; « voir en tant que » passe (l'administrateur regarde). */
export async function sessionAccessRefusal(user: { userId: string; session?: string }): Promise<AccountAccessRefusalBody | null> {
  if (user.session === "impersonation") return null;
  return accountAccessRefusal(user.userId);
}
