/**
 * Le socket (`/api/ws`) d'un compte bloqué (docs/DROITS-UTILISATEURS.md § 9.1) :
 * refusé à l'authentification, avec l'état qui le justifie — le client montre
 * sa page et ne se reconnecte pas en boucle (un `auth_error` l'arrête).
 */

import type { WebSocket } from "@fastify/websocket";
import type { ValidationResult } from "../../middleware/auth";
import { sessionAccessRefusal } from "./accountAccessState";
import {
  ACCOUNT_ACCESS_AUTH_ERROR,
  ACCOUNT_ACCESS_CLOSE_CODE,
  type AccountAccessBlocked,
} from "../../accountAccess/accountAccessContract";

/** L'état bloqué d'une authentification de socket — null : elle peut passer. */
export async function blockedSocketAccess(result: ValidationResult): Promise<AccountAccessBlocked | null> {
  if (!result.ok) return result.reason === "blocked" ? result.access : null;
  const refusal = await sessionAccessRefusal(result.user);
  if (!refusal) return null;
  const { error: _error, ...access } = refusal;
  return access;
}

/** Le refus : `auth_error` qui porte l'état, puis fermeture (4012). */
export function refuseBlockedSocket(ws: WebSocket, access: AccountAccessBlocked): void {
  ws.send(JSON.stringify({ type: "auth_error", reason: ACCOUNT_ACCESS_AUTH_ERROR, ...access }));
  ws.close(ACCOUNT_ACCESS_CLOSE_CODE, "Account access");
}
