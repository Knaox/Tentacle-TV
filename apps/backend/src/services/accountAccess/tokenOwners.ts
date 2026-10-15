/**
 * À quel compte appartient un jeton JELLYFIN (web, bureau, mobile) — pour dire
 * POURQUOI Jellyfin le refuse (docs/DROITS-UTILISATEURS.md § 9.1).
 *
 * Mesuré sur Jellyfin 10.11.11 : hors plage, un jeton ouvert prend 403 partout
 * (`/Users/Me` compris) et rien ne dit à qui il appartient ; désactivé, Jellyfin
 * RÉVOQUE ses jetons (401). Sans ce souvenir, Tentacle voyait un jeton invalide
 * et le client se déconnectait. Le compte de chaque jeton vu valide est donc
 * gardé en mémoire (empreinte du jeton, jamais le jeton) : refusé ensuite, on
 * relit la politique de CE compte. Rien n'est révoqué par Tentacle — revenu dans
 * sa plage, le même jeton reprend.
 */

import { hashToken } from "../jwt";
import { contentPolicyFromJellyfin, invalidateContentPolicy } from "../contentPolicy";
import { jellyfinAdminFetch } from "../jellyfinAdminFetch";
import { accessPolicyOf, accountAccessFor } from "./accountAccessState";
import { accountAccessOf } from "../../accountAccess/accountAccessRule";
import type { AccountAccessBlocked, AccountAccessState } from "../../accountAccess/accountAccessContract";

export interface TokenOwner {
  userId: string;
  username: string;
  isAdmin: boolean;
}

const MAX_OWNERS = 2_000;
const owners = new Map<string, TokenOwner>();

/** Retenir le compte d'un jeton que Jellyfin vient d'accepter (ou d'émettre). */
export function rememberTokenOwner(token: string, owner: TokenOwner): void {
  const key = hashToken(token);
  owners.delete(key);
  owners.set(key, { userId: owner.userId, username: owner.username, isAdmin: owner.isAdmin });
  // Le plus ancien sort d'abord : l'ordre d'insertion d'une Map.
  if (owners.size > MAX_OWNERS) owners.delete(owners.keys().next().value as string);
}

export function tokenOwner(token: string): TokenOwner | null {
  return owners.get(hashToken(token)) ?? null;
}

export function forgetTokenOwner(token: string): void {
  owners.delete(hashToken(token));
}

export interface BlockedJellyfinToken {
  access: AccountAccessBlocked;
  /** Null : un jeton dont on ne sait plus le compte (serveur redémarré pendant la fermeture). */
  owner: TokenOwner | null;
}

/**
 * Jellyfin vient de refuser ce jeton (401 ou 403) : son compte est-il BLOQUÉ ?
 * Compte connu : sa politique tranche. Inconnu : seul un 403 de `/Users/Me`
 * (`identityCheck`) le dit — Jellyfin a reconnu le jeton et refuse quand même,
 * ce qui n'arrive qu'hors plage (mesuré) ; partout ailleurs un 403 peut venir
 * d'un droit manquant (suppression, administration) et ne dit rien de l'accès.
 */
export async function blockedJellyfinToken(
  token: string,
  status: number,
  options: { identityCheck: boolean },
): Promise<BlockedJellyfinToken | null> {
  if (status !== 401 && status !== 403) return null;
  const owner = tokenOwner(token);
  if (owner) {
    let access = await accountAccessFor(owner.userId);
    // Jellyfin vient de refuser : la politique gardée (30 s) peut dater d'avant la
    // désactivation, qui révoque les jetons sur-le-champ — elle est relue.
    if (access.state === "allowed") access = await freshAccess(owner.userId);
    return access.state === "allowed" ? null : { access, owner };
  }
  if (status === 403 && options.identityCheck) {
    return { access: { state: "outsideSchedule", schedules: [], nextOpening: null }, owner: null };
  }
  return null;
}

/** Une relecture par compte toutes les 5 s au plus : une rafale de refus n'en fait qu'une. */
const FRESH_MS = 5_000;
const fresh = new Map<string, { at: number; access: AccountAccessState }>();

async function freshAccess(userId: string): Promise<AccountAccessState> {
  const memo = fresh.get(userId);
  if (memo && Date.now() - memo.at < FRESH_MS) return memo.access;
  const user = await jellyfinAdminFetch<{ Policy?: Record<string, unknown> }>(`/Users/${encodeURIComponent(userId)}`);
  const policy = user.ok && user.data?.Policy ? contentPolicyFromJellyfin(userId, user.data.Policy) : null;
  const access: AccountAccessState = policy ? accountAccessOf(accessPolicyOf(policy), Date.now()) : { state: "allowed" };
  fresh.set(userId, { at: Date.now(), access });
  // Bloqué : les portes et l'annonce doivent le voir aussi, sans attendre la fin du cache.
  if (access.state !== "allowed") invalidateContentPolicy(userId);
  return access;
}

export function resetTokenOwnersForTests(): void {
  owners.clear();
  fresh.clear();
}
