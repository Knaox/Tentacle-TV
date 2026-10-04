import type { FamilyErrorBody } from "../../family/familyProtocol";
import { isFamilyGuest } from "./familyGuestMarkers";

/**
 * Ce qu'une SESSION DE PROFIL de TV n'atteint jamais (docs/FAMILLE.md) —
 * appliqué par `requireAuth` / `requireAdmin`, donc aussi aux routes des
 * plugins. Une session de profil REGARDE ; elle n'administre rien : sans quoi
 * un membre retiré garderait un accès par une TV jumelée depuis son profil.
 *
 * - toute session de profil : ni push, ni téléchargements, ni jumelage d'un
 *   autre appareil, ni gestion du compte (suppression, mot de passe, comptes
 *   externes, clés d'invitation) ;
 * - un INVITÉ, en plus : ni Watch Together, ni tickets, ni liens de partage,
 *   ni extensions (Vigie) — il n'apparaît dans AUCUNE liste (SEC-F-21).
 *
 * Un MEMBRE garde Vigie sur la TV : c'est un vrai compte, ses demandes sont
 * les siennes.
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

const GUEST_DENIED = ["/api/watch-together", "/api/tickets", "/api/share", "/api/plugins"];

function within(path: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** Le refus (403) d'une session de profil sur ce chemin, ou null. */
export async function profileSessionRefusal(
  url: string,
  user: { userId: string; session?: string },
): Promise<FamilyErrorBody | null> {
  if (user.session !== "tvProfile") return null;
  const path = url.split("?")[0] ?? "";
  if (within(path, PROFILE_DENIED)) {
    return { code: "family.personal_session_required", message: "Geste impossible depuis un profil de TV" };
  }
  if (within(path, GUEST_DENIED) && (await isFamilyGuest(user.userId))) {
    return { code: "family.guest_account", message: "Indisponible pour un profil invité" };
  }
  return null;
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
