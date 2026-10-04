import type { FamilyErrorBody } from "../../family/familyProtocol";
import { EXTENSIONS_PREFIX, guestExtensionAccess } from "./familyGuestExtensions";
import { isFamilyGuest } from "./familyGuestMarkers";

/**
 * Ce qu'une SESSION DE PROFIL de TV atteint (docs/FAMILLE.md) — appliqué par
 * `requireAuth` / `requireAdmin`, donc aussi aux routes des extensions. Une
 * session de profil REGARDE ; elle n'administre rien : sans quoi un membre
 * retiré garderait un accès par une TV jumelée depuis son profil.
 *
 * - toute session de profil : ni push, ni téléchargements, ni jumelage d'un
 *   autre appareil, ni gestion du compte (suppression, mot de passe, comptes
 *   externes, clés d'invitation) ;
 * - un INVITÉ, en plus : ni Watch Together, ni tickets, ni liens de partage —
 *   il n'apparaît dans AUCUNE liste (SEC-F-21) ; les extensions, seulement si
 *   le propriétaire lui a permis « peut demander », et alors à SON PROPRE NOM
 *   (`familyGuestExtensions.ts`) ; sans ce droit, aucune.
 *
 * Un MEMBRE garde ses extensions sous SON identité : c'est un vrai compte, ses
 * demandes sont les siennes.
 */

const PROFILE_DENIED = [
  "/api/push",
  "/api/downloads",
  "/api/pair",
  "/api/auth/account",
  "/api/auth/change-password",
  "/api/external",
  "/api/invites",
];

const GUEST_DENIED = ["/api/watch-together", "/api/tickets", "/api/share"];

function within(path: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export interface ScopedUser {
  userId: string;
  username: string;
  session?: string;
  pairingId?: string;
}

/** Le verdict sur une requête : passer — sur une route d'extension, un invité
 *  autorisé sous le nom de son compte Jellyfin (`accountName`) — ou refuser (403). */
export type ProfileScope = { kind: "pass"; accountName?: string } | { kind: "refuse"; body: FamilyErrorBody };

const PASS: ProfileScope = { kind: "pass" };

function guestRefusal(): ProfileScope {
  return { kind: "refuse", body: { code: "family.guest_account", message: "Indisponible pour un profil invité" } };
}

export async function profileSessionScope(url: string, user: ScopedUser): Promise<ProfileScope> {
  if (user.session !== "tvProfile") return PASS;
  const path = url.split("?")[0] ?? "";
  if (within(path, PROFILE_DENIED)) {
    return { kind: "refuse", body: { code: "family.personal_session_required", message: "Geste impossible depuis un profil de TV" } };
  }
  if (within(path, GUEST_DENIED)) return (await isFamilyGuest(user.userId)) ? guestRefusal() : PASS;
  if (within(path, [EXTENSIONS_PREFIX])) {
    const access = await guestExtensionAccess(user.userId);
    if (access === null) return PASS;
    if (access === "denied") return guestRefusal();
    return access.accountName ? { kind: "pass", accountName: access.accountName } : PASS;
  }
  return PASS;
}

/** Watch Together sur le socket : jamais pour un invité. */
export async function canUseWatchTogether(user: { userId: string; session?: string }): Promise<boolean> {
  if (user.session !== "tvProfile") return true;
  try {
    return !(await isFamilyGuest(user.userId));
  } catch {
    return false;
  }
}
