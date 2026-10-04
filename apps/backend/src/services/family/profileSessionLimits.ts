import type { FamilyErrorBody } from "../../family/familyProtocol";
import { EXTENSIONS_PREFIX, extensionDelegate, type ExtensionIdentity } from "./familyDelegation";
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
 *   le propriétaire lui a permis « peut demander », et alors AU NOM du
 *   propriétaire (`familyDelegation.ts`) ; sans ce droit, aucune.
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

/** Le verdict sur une requête : passer telle quelle, refuser (403), ou — sur
 *  une route d'extension, pour un invité autorisé — agir pour le propriétaire. */
export type ProfileScope =
  | { kind: "pass" }
  | { kind: "refuse"; body: FamilyErrorBody }
  | { kind: "actFor"; identity: ExtensionIdentity };

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
    const delegate = await extensionDelegate(user.userId);
    if (delegate === null) return PASS;
    if (delegate === "denied") return guestRefusal();
    return { kind: "actFor", identity: delegate };
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
