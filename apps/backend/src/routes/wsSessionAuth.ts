import type { WebSocket } from "@fastify/websocket";
import { validateToken, type JellyfinUser, type ValidationResult } from "../middleware/auth";
import { addConnection } from "../services/wsManager";
import { isDeviceRevoked } from "../services/pairedDeviceStatus";
import { jellyfinHealth } from "../services/jellyfinHealth";
import { hashToken } from "../services/jwt";
import { FAMILY_PROFILE_ENDED_CLOSE_CODE } from "../family/familyProtocol";
import { blockedSocketAccess, refuseBlockedSocket } from "../services/accountAccess/socketAccess";

/**
 * L'authentification d'une socket temps réel, en deux temps : le VERDICT sur un
 * jeton (`checkSocketToken`, sans rien dire à la socket), puis la LIAISON
 * (`bindSocketSession` : `auth_ok`, la socket rangée sous son compte et son
 * appareil). Séparés pour qu'un verdict dépassé — le client s'est annoncé
 * entre-temps par son message `auth`, qui l'emporte sur le cookie de son pot
 * (cf. `wsAnnouncement.ts`) — ne lie ni ne ferme rien.
 */

export interface BoundSession {
  user: JellyfinUser;
  /** sha256 du token — clé de ciblage pour la révocation d'appareil. */
  tokenHash: string;
  /** Le token lui-même : le canal de session en tire le jeton Jellyfin. */
  token: string;
}

export type SocketTokenCheck =
  | { ok: true; session: BoundSession }
  | { ok: false; refuse: (ws: WebSocket) => void };

export async function checkSocketToken(token: string): Promise<SocketTokenCheck> {
  const result = await validateToken(token);
  const tokenHash = hashToken(token);
  // Révoqué pendant la validation : la révocation a poussé AVANT que cette
  // socket ne soit connue — elle ne l'aurait jamais fermée.
  const revoked = result.ok ? isDeviceRevoked(tokenHash) : "revoked" in result && result.revoked === true;
  const profileEnded = result.ok ? result.user.session === "tvProfile" : "profileEnded" in result && result.profileEnded === true;
  // Désactivé ou hors plage : refusé avec l'état, sans reconnexion en boucle (cf. socketAccess).
  const blocked = revoked ? null : await blockedSocketAccess(result);
  if (blocked) return { ok: false, refuse: (ws) => refuseBlockedSocket(ws, blocked) };
  if (!result.ok || revoked) return { ok: false, refuse: (ws) => refuseSocket(ws, result, revoked, profileEnded) };
  return { ok: true, session: { user: result.user, tokenHash, token } };
}

function refuseSocket(ws: WebSocket, result: ValidationResult, revoked: boolean, profileEnded: boolean): void {
  if (revoked && profileEnded) {
    // Une session de profil (Famille) terminée : la TV revient à « Qui
    // regarde ? » — surtout pas `revoked`, qui la déjumellerait.
    ws.send(JSON.stringify({ type: "auth_error", reason: "profile_ended" }));
    ws.close(FAMILY_PROFILE_ENDED_CLOSE_CODE, "Profile session ended");
  } else if (revoked) {
    // Le jumelage n'existe plus — typiquement une TV éteinte pendant qu'on la
    // déjumelait : elle l'apprend dès qu'elle se reconnecte.
    ws.send(JSON.stringify({ type: "auth_error", reason: "revoked" }));
    ws.close(4009, "Device revoked");
  } else if (!result.ok && result.reason === "unreachable") {
    // Jellyfin absent : impossible de juger ce jeton — mais on dit pourquoi,
    // pour que le lecteur montre « Jellyfin redémarre » plutôt qu'une erreur.
    const health = jellyfinHealth();
    if (health.state !== "up") ws.send(JSON.stringify({ type: "server:jellyfin", state: health.state, since: health.since }));
    ws.send(JSON.stringify({ type: "auth_error", reason: "server_unreachable" }));
    ws.close(4003, "Server unreachable");
  } else {
    ws.send(JSON.stringify({ type: "auth_error", reason: "invalid_token" }));
    ws.close(4001, "Authentication failed");
  }
}

/** La socket parle désormais au nom de cette session. */
export function bindSocketSession(ws: WebSocket, session: BoundSession): void {
  ws.send(JSON.stringify({ type: "auth_ok" }));
  addConnection(session.user.userId, ws, session.tokenHash);
}
