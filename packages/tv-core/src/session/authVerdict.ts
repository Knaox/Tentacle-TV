/**
 * Un VERDICT du serveur sur un jeton (rafraîchi, refusé, « révoqué ») ne vaut
 * que pour ce jeton. Module pur.
 *
 * Pendant l'appel, la session a pu changer sous lui — l'échange d'une TV qui
 * passe aux profils remplace l'ancien jeton par le jeton de jumelage, une
 * session de profil s'ouvre ou se ferme. Le verdict parle alors d'un jeton
 * qui n'est plus celui de la session : il ne s'applique pas. Vécu au
 * simulateur (2026-10-04) : un rafraîchissement parti avec l'ancien jeton,
 * revenu « révoqué » juste après l'échange, déjumelait la TV.
 */
export function authVerdictApplies(tokenSent: string, tokenNow: string | null): boolean {
  return tokenNow === tokenSent;
}

/** Ce que le serveur a répondu à un rafraîchissement de session (`apps/tv/src/auth/tokenRefresh.ts`). */
export type RefreshVerdict =
  | { ok: true; accessToken: string }
  | { ok: false; reason: "expired" | "network" | "server"; revoked?: boolean; profileEnded?: boolean };

/** Ce que l'app fait d'un verdict de rafraîchissement. */
export type RefreshAction =
  /** La session a changé pendant l'appel : le verdict parle d'un autre jeton. */
  | { kind: "ignore" }
  /** Le jeton est rafraîchi : il devient celui de la session. */
  | { kind: "adopt"; accessToken: string }
  /** Serveur muet ou en panne : la session reste intacte. */
  | { kind: "keep" }
  /** Une session de PROFIL fermée par le serveur : retour à « Qui regarde ? » (jamais un déjumelage). */
  | { kind: "endProfile" }
  /** Le JUMELAGE est révoqué : déjumeler — après avoir rejoué un échange resté sans réponse, s'il y en a un. */
  | { kind: "revoked" }
  /** Expiré sans révocation : une nouvelle connexion par les identifiants enregistrés. */
  | { kind: "reauth" };

/**
 * La DÉCISION d'un rafraîchissement — testée ici, appliquée par
 * `sessionFlow` : d'abord, le verdict concerne-t-il encore la session
 * (`authVerdictApplies`) ? Seule une révocation confirmée (`revoked`) ferme
 * quelque chose ; un 401 nu ne fait que relancer une connexion.
 */
export function refreshAction(tokenSent: string, tokenNow: string | null, verdict: RefreshVerdict): RefreshAction {
  if (!authVerdictApplies(tokenSent, tokenNow)) return { kind: "ignore" };
  if (verdict.ok) return { kind: "adopt", accessToken: verdict.accessToken };
  if (verdict.reason !== "expired") return { kind: "keep" };
  if (verdict.revoked === true) return verdict.profileEnded === true ? { kind: "endProfile" } : { kind: "revoked" };
  return { kind: "reauth" };
}
