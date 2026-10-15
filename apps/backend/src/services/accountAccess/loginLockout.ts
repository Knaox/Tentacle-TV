/**
 * Les ESSAIS AVANT BLOCAGE (docs/DROITS-UTILISATEURS.md § 9.1) — ce que Jellyfin
 * 10.11.11 ne fait pas, appliqué par Tentacle aux connexions qui passent par lui
 * (décision du coordinateur, 2026-10-15).
 *
 * Mesuré et relu (`UserManager.AuthenticateUser`, 10.11.11) : le compteur
 * `InvalidLoginAttemptCount` avance d'un par mot de passe faux, Jellyfin
 * journalise « Disabling user… » mais NE désactive PAS (entité `AsNoTracking`,
 * `SaveChanges` sans effet) ; une réussite ne remet pas toujours le compteur à 0
 * (l'entité périmée est réécrite). Corrigé sur `master` (Jellyfin 12) : là, les
 * écritures ci-dessous ne trouvent plus rien à faire.
 *
 * - Après un échec : la politique relue ; compteur ≥ limite (> 0) et compte encore
 *   actif → `IsDisabled=true` par la réécriture complète de la politique.
 *   Jellyfin refuse de désactiver un administrateur : il ne l'est donc pas.
 * - Après une réussite : compteur remis à 0 (la politique le porte : mesuré, il
 *   tient). Avant une connexion, et après toute écriture faite par Tentacle (la
 *   fiche des droits qui RÉACTIVE un compte) : un compte actif au compteur resté
 *   plein repart de 0 — sinon le premier échec le rebloquerait.
 * - Hors de portée : une connexion faite directement à Jellyfin, sans Tentacle.
 */

import { jellyfinAdminFetch } from "../jellyfinAdminFetch";
import { notePolicyWritten, onPolicyWritten } from "../userRights/policyWritten";
import { reachedLoginAttempts } from "../../accountAccess/accountAccessRule";

interface JellyfinUserDto {
  Id?: string;
  Name?: string;
  Policy?: Record<string, unknown>;
}

type KnownUser = { Id: string; Name: string; Policy: Record<string, unknown> };

const numberOr = (value: unknown): number | undefined => (typeof value === "number" ? value : undefined);

function counterOf(policy: Record<string, unknown>) {
  return {
    invalidLoginAttemptCount: numberOr(policy.InvalidLoginAttemptCount),
    loginAttemptsBeforeLockout: numberOr(policy.LoginAttemptsBeforeLockout),
  };
}

/** Un compte ACTIF au compteur plein : réactivé, ou laissé tel quel par Jellyfin 10.11. */
function staleCounter(policy: Record<string, unknown>): boolean {
  return policy.IsDisabled !== true && reachedLoginAttempts(counterOf(policy));
}

function known(user: JellyfinUserDto | null | undefined): KnownUser | null {
  return user && typeof user.Id === "string" && user.Policy && typeof user.Policy === "object"
    ? { Id: user.Id, Name: user.Name ?? "", Policy: user.Policy }
    : null;
}

async function userById(userId: string): Promise<KnownUser | null> {
  const result = await jellyfinAdminFetch<JellyfinUserDto>(`/Users/${encodeURIComponent(userId)}`);
  return result.ok ? known(result.data) : null;
}

async function userByName(username: string): Promise<KnownUser | null> {
  const users = await jellyfinAdminFetch<JellyfinUserDto[]>("/Users");
  if (!users.ok || !Array.isArray(users.data)) return null;
  const wanted = username.trim().toLowerCase();
  return known(users.data.find((user) => typeof user.Name === "string" && user.Name.toLowerCase() === wanted));
}

/** La politique RELUE juste avant, réécrite entière avec ce seul changement. */
async function rewritePolicy(userId: string, change: Record<string, unknown>): Promise<boolean> {
  const fresh = await userById(userId);
  if (!fresh) return false;
  const written = await jellyfinAdminFetch(`/Users/${encodeURIComponent(userId)}/Policy`, {
    method: "POST",
    body: { ...fresh.Policy, ...change },
    expectEmpty: true,
  });
  await notePolicyWritten(userId);
  return written.ok;
}

async function resetCounter(user: KnownUser, why: string): Promise<void> {
  if (await rewritePolicy(user.Id, { InvalidLoginAttemptCount: 0 })) {
    console.log(`[account-access] ${user.Name} : compteur d'essais remis à zéro (${why})`);
  }
}

/** Avant une connexion par mot de passe : un compteur resté plein repart de 0. */
export async function beforePasswordLogin(username: string): Promise<void> {
  const user = await userByName(username);
  if (user && staleCounter(user.Policy)) await resetCounter(user, "compte actif au compteur plein");
}

/**
 * Après la connexion : réussite → compteur à 0 ; échec → bloqué si la limite est
 * atteinte. Rend `lockedOut` quand CET échec vient de bloquer le compte.
 */
export async function afterPasswordLogin(username: string, succeeded: boolean): Promise<"lockedOut" | null> {
  const user = await userByName(username);
  if (!user) return null;
  if (succeeded) {
    if ((numberOr(user.Policy.InvalidLoginAttemptCount) ?? 0) > 0) await resetCounter(user, "connexion réussie");
    return null;
  }
  if (user.Policy.IsDisabled === true || !reachedLoginAttempts(counterOf(user.Policy))) return null;
  const locked = await rewritePolicy(user.Id, { IsDisabled: true });
  console.log(
    locked
      ? `[account-access] ${user.Name} bloqué après trop d'essais (Jellyfin 10.11 ne le fait pas)`
      : `[account-access] ${user.Name} : Jellyfin refuse de le bloquer (un administrateur ne se désactive pas)`,
  );
  return locked ? "lockedOut" : null;
}

let registered = false;

/** Après toute écriture de politique faite par Tentacle (la fiche des droits qui réactive) : le compteur suit. */
export function registerLoginLockoutRepair(): void {
  if (registered) return;
  registered = true;
  onPolicyWritten(async (userId) => {
    const user = await userById(userId);
    if (user && staleCounter(user.Policy)) await resetCounter(user, "compte réactivé");
  });
}
