import { getPrisma, hasPrisma } from "../db";
import { retryOnWriteConflict } from "../dbRetry";
import { jellyfinAdminFetch } from "../jellyfinAdminFetch";
import { invalidateJellyfinUsers } from "../watchTogether/usersCache";
import { forgetFamilyGuests } from "./familyGuestMarkers";
import { fold } from "./familyStore";

/**
 * Le journal des comptes Jellyfin d'invités à supprimer
 * (`guest_account_cleanups`) — ce qui garantit qu'un invité supprimé l'est
 * VRAIMENT chez Jellyfin : Jellyfin injoignable ou qui refuse au moment du
 * geste, Tentacle qui plante, aucun compte n'y survit.
 *
 * - Suppression d'un invité, dissolution : l'entrée s'écrit DANS la
 *   transaction qui retire l'invité de la base (`retireGuestRow`). Le geste
 *   aboutit toujours ; le compte part aussitôt, et jusqu'à confirmation sinon.
 * - Création (`creating`) : l'entrée s'écrit dès que Jellyfin a rendu
 *   l'identifiant du compte, et se solde quand la ligne de l'invité existe.
 *   Une création qui échoue (`abandoned`) ou qu'un plantage interrompt ne
 *   laisse donc aucun compte orphelin. Jamais balayée avant
 *   `CREATING_GRACE_MS` : une création en cours n'est pas une création morte.
 *
 * Nouvel essai à 1 min, 5 min, 15 min, 1 h, puis toutes les 6 h — au
 * démarrage et à chaque balayage de la Famille (`familySweep.ts`).
 *
 * Règle unique : un compte qui est ENCORE une personne de la Famille
 * (propriétaire, membre, invité vivant) n'est jamais touché, son entrée est
 * soldée ; tout autre est supprimé de Jellyfin — jamais un administrateur. Un
 * compte inconnu de Jellyfin compte pour supprimé. Tant qu'il existe, le
 * compte reste un invité pour toutes les listes (`familyGuestMarkers.ts`).
 */

export type GuestCleanupReason = "creating" | "abandoned" | "guest_deleted" | "dissolved";

export const CREATING_GRACE_MS = 5 * 60_000;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000];
const SWEEP_BATCH = 50;

type Outcome = { done: true; kept?: "family" | "admin" } | { done: false; error: string };

function retryDelay(attempts: number): number {
  return RETRY_DELAYS_MS[Math.min(attempts, RETRY_DELAYS_MS.length - 1)];
}

/** L'écriture du journal. Une suppression l'emporte sur une création :
 *  `creating` ne rétrograde jamais une autre raison. */
function upsertEntry(jellyfinUserId: string, jellyfinName: string | null, reason: GuestCleanupReason) {
  return getPrisma().guestAccountCleanup.upsert({
    where: { jellyfinUserId },
    create: { jellyfinUserId, jellyfinName, reason },
    update: reason === "creating" ? {} : { reason, nextAttemptAt: new Date() },
  });
}

/** Le compte part de Jellyfin — sauf un administrateur, qu'on ne touche jamais. */
async function removeAccount(jellyfinUserId: string): Promise<Outcome> {
  const path = `/Users/${encodeURIComponent(jellyfinUserId)}`;
  const read = await jellyfinAdminFetch<{ Policy?: { IsAdministrator?: boolean } }>(path);
  if (!read.ok) return read.status === 404 ? { done: true } : { done: false, error: read.status ? `HTTP ${read.status}` : read.failure };
  if (read.data?.Policy?.IsAdministrator === true) return { done: true, kept: "admin" };
  const removed = await jellyfinAdminFetch(path, { method: "DELETE", expectEmpty: true });
  invalidateJellyfinUsers();
  if (removed.ok || removed.status === 404) return { done: true };
  return { done: false, error: removed.status ? `HTTP ${removed.status}` : removed.failure };
}

/** Une personne de la Famille n'est jamais supprimée — identifiants pliés :
 *  un même compte s'écrit avec ou sans tirets. */
async function isFamilyPerson(jellyfinUserId: string): Promise<boolean> {
  const prisma = getPrisma();
  const [rows, families] = await Promise.all([
    prisma.familyMember.findMany({ select: { userId: true } }),
    prisma.family.findMany({ select: { ownerUserId: true } }),
  ]);
  const target = fold(jellyfinUserId);
  return rows.some((row) => fold(row.userId) === target) || families.some((family) => fold(family.ownerUserId) === target);
}

/** Inscrit un compte au journal, hors de toute transaction. */
export async function noteGuestAccount(jellyfinUserId: string, jellyfinName: string | null, reason: GuestCleanupReason): Promise<void> {
  await upsertEntry(jellyfinUserId, jellyfinName, reason);
  forgetFamilyGuests();
}

/** La création a abouti : la ligne de l'invité porte le compte. Ne solde
 *  jamais une suppression. */
export async function settleCreatedGuest(jellyfinUserId: string): Promise<void> {
  await getPrisma().guestAccountCleanup.deleteMany({ where: { jellyfinUserId, reason: "creating" } });
}

/** L'invité quitte la base et son compte entre au journal, ENSEMBLE : jamais
 *  l'un sans l'autre. La suppression chez Jellyfin suit (`cleanupGuestAccount`). */
export async function retireGuestRow(
  row: { id: string; userId: string; jellyfinName: string | null },
  reason: "guest_deleted" | "dissolved",
): Promise<void> {
  const prisma = getPrisma();
  await retryOnWriteConflict(() =>
    prisma.$transaction([
      upsertEntry(row.userId, row.jellyfinName, reason),
      prisma.familyMember.deleteMany({ where: { id: row.id } }),
      prisma.profilePin.deleteMany({ where: { userId: row.userId } }),
      prisma.profilePinAttempt.deleteMany({ where: { userId: row.userId } }),
    ]),
  );
  forgetFamilyGuests();
}

/**
 * Traite une entrée tout de suite. `true` : soldée (compte supprimé ou absent,
 * personne à garder) ; `false` : Jellyfin n'a pas confirmé, nouvel essai
 * planifié.
 */
export async function cleanupGuestAccount(jellyfinUserId: string, now: number = Date.now()): Promise<boolean> {
  if (!hasPrisma()) return false;
  const prisma = getPrisma();
  const entry = await prisma.guestAccountCleanup.findUnique({ where: { jellyfinUserId } });
  if (!entry) return true;
  const label = entry.jellyfinName ?? "?";
  const outcome: Outcome = (await isFamilyPerson(jellyfinUserId)) ? { done: true, kept: "family" } : await removeAccount(jellyfinUserId);
  if (!outcome.done) {
    await prisma.guestAccountCleanup.updateMany({
      where: { jellyfinUserId },
      data: { attempts: entry.attempts + 1, lastError: outcome.error.slice(0, 255), nextAttemptAt: new Date(now + retryDelay(entry.attempts)) },
    });
    console.log(`[family] Compte invité « ${label} » pas encore supprimé de Jellyfin (${outcome.error}, essai ${entry.attempts + 1}) : il le sera`);
    return false;
  }
  if (outcome.kept === "admin") console.log(`[family] Compte « ${label} » administrateur : jamais supprimé, entrée soldée`);
  else if (!outcome.kept) console.log(`[family] Compte invité « ${label} » supprimé de Jellyfin`);
  await prisma.guestAccountCleanup.deleteMany({ where: { jellyfinUserId } });
  forgetFamilyGuests();
  return true;
}

/** Une création qui n'aboutit pas : le compte part aussitôt, et jusqu'à
 *  confirmation sinon. Base muette : le seul geste possible, tout de suite. */
export async function abandonGuestAccount(jellyfinUserId: string, jellyfinName: string | null): Promise<void> {
  try {
    await noteGuestAccount(jellyfinUserId, jellyfinName, "abandoned");
  } catch {
    await removeAccount(jellyfinUserId).catch(() => undefined);
    return;
  }
  await cleanupGuestAccount(jellyfinUserId).catch(() => false);
}

/** Les comptes des invités d'une dissolution, en parallèle (trois au plus). */
export async function cleanupGuestAccounts(jellyfinUserIds: string[]): Promise<void> {
  await Promise.all(jellyfinUserIds.map((id) => cleanupGuestAccount(id).catch(() => false)));
}

/** Le balayage : au démarrage (reprise après plantage), puis à chaque passage
 *  du balayage de la Famille. Les créations récentes sont laissées à leur auteur. */
export async function sweepGuestAccounts(now: number = Date.now()): Promise<void> {
  if (!hasPrisma()) return;
  const due = await getPrisma().guestAccountCleanup.findMany({
    where: { nextAttemptAt: { lte: new Date(now) } },
    orderBy: { nextAttemptAt: "asc" },
    take: SWEEP_BATCH,
  });
  for (const entry of due) {
    if (entry.reason === "creating" && now - entry.createdAt.getTime() < CREATING_GRACE_MS) continue;
    await cleanupGuestAccount(entry.jellyfinUserId, now).catch(() => false);
  }
}
