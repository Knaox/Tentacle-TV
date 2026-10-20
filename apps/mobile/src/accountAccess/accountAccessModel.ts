import { accountConnectRefusalOf } from "@tentacle-tv/shared";

/**
 * Les règles PURES de l'accès du compte sur le mobile (docs/DROITS-UTILISATEURS.md
 * § 9.1 et § 9.10) : les sorties de la page d'un compte bloqué, l'écran à quitter
 * (lecteur, bande-annonce), et le refus d'une connexion dit en mots.
 */

export type AccountAccessAction = "switchProfile" | "signOut" | "changeServer";

/** Une session de profil : « Changer de profil » (retour au compte) ; sinon se déconnecter ou changer de serveur. */
export function accountAccessActions(profileSession: boolean): AccountAccessAction[] {
  return profileSession ? ["switchProfile", "signOut"] : ["signOut", "changeServer"];
}

/** Les écrans qui lisent un média (flux du serveur ou titre gardé, bande-annonce) : ils se
 *  ferment quand la page paraît — la lecture ne reprend pas d'elle-même. */
export function isPlaybackRoute(pathname: string): boolean {
  return /^\/(watch|trailer)(\/|$)/.test(pathname);
}

/** Une connexion refusée par le serveur (désactivé, bloqué, hors plage, trop de sessions) : la clé à dire, ou null. */
export function loginRefusalKey(status: number, body: unknown): { key: string; options: { count: number } } | null {
  if (status !== 403) return null;
  const refusal = accountConnectRefusalOf(body);
  return refusal ? { key: `accountAccess:refusals.${refusal.code}`, options: { count: refusal.maxSessions ?? 1 } } : null;
}
