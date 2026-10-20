import type { FastifyReply, FastifyRequest } from "fastify";
import { getTokenFromRequest } from "../../middleware/auth";
import { sameUserId } from "../../family/familyRules";
import { verifyDeviceToken } from "../../services/jwt";
import { endPickerHost } from "../../services/family/familyPickerHosts";
import { ACCOUNT_ESCROW_COOKIE, SESSION_COOKIE, clearAccountEscrowCookie, setAccountEscrowCookie, setSessionCookie } from "../authCookie";

/**
 * La réserve du compte d'un navigateur en session de profil (`authCookie.ts`,
 * `ACCOUNT_ESCROW_COOKIE`) — LUE seulement par les routes de « Qui regarde ? »
 * jouées par la session personnelle (lister, choisir, la photo d'un invité),
 * ÉCRITE seulement par le choix d'un profil depuis le web.
 */

function cookiesOf(request: FastifyRequest): Record<string, string | undefined> {
  return ((request as unknown as { cookies?: Record<string, string | undefined> }).cookies) ?? {};
}

/** Un jeton d'appareil ou de profil (JWT) ; un jeton Jellyfin n'en a pas la forme. */
function isDeviceJwt(token: string): boolean {
  return token.split(".").length === 3;
}

/**
 * Le jeton de la réserve, s'il vaut pour cette requête : seulement derrière une
 * session de profil (le cookie de session est un JWT d'appareil, vivant ou
 * terminé) — jamais face à une session personnelle, qui l'emporte (une réserve
 * oubliée ne remplace jamais le compte connecté), ni sans session (déconnecté).
 */
export function escrowedAccountToken(request: FastifyRequest): string | null {
  const cookies = cookiesOf(request);
  const escrow = cookies[ACCOUNT_ESCROW_COOKIE];
  const session = cookies[SESSION_COOKIE];
  if (!escrow || !session || !isDeviceJwt(session)) return null;
  return escrow;
}

/** Le jeton de la SESSION PERSONNELLE de la requête : la réserve d'abord, sinon celui des portes. */
export function personalTokenFromRequest(request: FastifyRequest): string | null {
  return escrowedAccountToken(request) ?? getTokenFromRequest(request);
}

/** Le web entre dans le profil d'un autre : le compte part en réserve, le profil devient la session. */
export function escrowAccount(reply: FastifyReply, personalToken: string, profileToken: string): void {
  setAccountEscrowCookie(reply, personalToken);
  setSessionCookie(reply, profileToken);
}

/** Le web revient à son compte (derrière son code) : la session personnelle reprend, la réserve s'efface. */
export function releaseAccount(reply: FastifyReply, personalToken: string): void {
  setSessionCookie(reply, personalToken);
  clearAccountEscrowCookie(reply);
}

/**
 * La photo d'un invité pendant SA session de profil sur le web : la réserve ne
 * vaut que pour l'invité dont c'est la session (le bureau ne propose ce geste
 * que là) — la session d'un autre profil ne s'en sert jamais pour agir au nom
 * du compte. Ailleurs, le jeton des portes.
 */
export async function guestPhotoTokenFromRequest(request: FastifyRequest): Promise<string | null> {
  const escrow = escrowedAccountToken(request);
  const session = cookiesOf(request)[SESSION_COOKIE];
  if (escrow && session) {
    const target = (request.params as { userId?: unknown } | undefined)?.userId;
    const profile = await verifyDeviceToken(session);
    if (profile && typeof target === "string" && sameUserId(profile.userId, target)) return escrow;
  }
  return getTokenFromRequest(request);
}

interface EscrowRequest {
  accountEscrow?: string;
  accountEscrowRaw?: string;
}

/**
 * Première `preHandler` de la déconnexion : la réserve part AVANT que les portes
 * jugent la session (celle d'un profil terminé y serait refusée, et la réserve
 * survivrait) — le cookie est effacé dans la réponse, quelle qu'elle soit. Si
 * elle valait (`escrowedAccountToken`), la route déconnecte ce compte-là ;
 * `closeEscrowedHost` ferme ensuite son hôte, même après un refus.
 */
export async function releaseEscrowOnLogout(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const raw = cookiesOf(request)[ACCOUNT_ESCROW_COOKIE];
  if (!raw) return;
  const valid = escrowedAccountToken(request);
  clearAccountEscrowCookie(reply);
  const held = request as unknown as EscrowRequest;
  held.accountEscrowRaw = raw;
  if (valid) held.accountEscrow = valid;
}

/** `onResponse` de la déconnexion : l'hôte de la réserve et ses profils fermés (idempotent). */
export async function closeEscrowedHost(request: FastifyRequest): Promise<void> {
  const raw = (request as unknown as EscrowRequest).accountEscrowRaw;
  if (raw) await endPickerHost(raw).catch(() => false);
}

/** Le compte en réserve que la déconnexion doit fermer ; null sans réserve valable. */
export function escrowLoggingOut(request: FastifyRequest): string | null {
  return (request as unknown as EscrowRequest).accountEscrow ?? null;
}
