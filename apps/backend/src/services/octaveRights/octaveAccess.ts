import { getPrisma, hasPrisma } from "../db";
import { fold } from "../family/familyStore";
import { resolveOctaveAccess, type StoredOctaveRights } from "../../octaveRights/octaveRightsContract";

/**
 * « Accès à Octave » (capacité `octave.rights`) — ce que vaut le droit d'un
 * compte, lu dans `octave_account_rights` (sans ligne : permis). Un invité de
 * la Famille vaut son créateur (le propriétaire pour une ligne d'avant la v2).
 *
 * Gardé 30 s par compte, tout oublié à chaque écriture (un invité dépend de son
 * créateur). Base muette : FERMÉ à l'échec, gardé 5 s seulement — comme la
 * politique de contenu.
 */

const TTL_MS = 30_000;
const FAILED_TTL_MS = 5_000;
const MAX_ENTRIES = 2_000;

const cache = new Map<string, { access: boolean; expiresAt: number }>();

async function storedFor(userId: string): Promise<StoredOctaveRights | null> {
  const row = await getPrisma().octaveAccountRights.findUnique({ where: { userId: fold(userId) } });
  return row ? { access: row.access } : null;
}

/** Le créateur d'un invité de la Famille ; `null` : ce compte n'est pas un invité. */
export async function guestCreatorOf(userId: string): Promise<string | null> {
  const row = await getPrisma().familyMember.findUnique({ where: { userId } });
  if (!row || row.kind !== "guest") return null;
  if (row.createdBy) return row.createdBy;
  const family = await getPrisma().family.findUnique({ where: { id: row.familyId } });
  // Famille disparue : l'invité ne vaut plus personne — fermé.
  return family?.ownerUserId ?? "";
}

async function readAccess(userId: string): Promise<boolean> {
  const creator = await guestCreatorOf(userId);
  if (creator === null) return resolveOctaveAccess({ guest: false, own: await storedFor(userId), creator: null });
  if (creator === "") return false;
  return resolveOctaveAccess({ guest: true, own: null, creator: await storedFor(creator) });
}

/** Le compte a-t-il « Accès à Octave » ? Jamais une exception. */
export async function hasOctaveAccess(userId: string, now = Date.now()): Promise<boolean> {
  if (!userId) return false;
  if (!hasPrisma()) return true;
  const key = fold(userId);
  const hit = cache.get(key);
  if (hit && now < hit.expiresAt) return hit.access;
  let access: boolean;
  let ttl = TTL_MS;
  try {
    access = await readAccess(userId);
  } catch {
    access = false;
    ttl = FAILED_TTL_MS;
  }
  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(key, { access, expiresAt: now + ttl });
  return access;
}

/** Ce qui est GARDÉ pour ce compte (sa ligne), sans la règle des invités. */
export async function storedOctaveAccess(userId: string): Promise<boolean> {
  return (await storedFor(userId))?.access ?? true;
}

export async function writeOctaveAccess(userId: string, access: boolean): Promise<void> {
  const key = fold(userId);
  await getPrisma().octaveAccountRights.upsert({ where: { userId: key }, create: { userId: key, access }, update: { access } });
  cache.clear();
}

/** Les invités dont ce compte est le créateur (ils suivent son accès). */
export async function guestsCreatedBy(userId: string): Promise<string[]> {
  const key = fold(userId);
  const guests = await getPrisma().familyMember.findMany({ where: { kind: "guest" } });
  const owned = new Set(
    (await getPrisma().family.findMany({ where: { id: { in: [...new Set(guests.map((guest) => guest.familyId))] } } }))
      .filter((family) => fold(family.ownerUserId) === key)
      .map((family) => family.id),
  );
  return guests
    .filter((guest) => (guest.createdBy ? fold(guest.createdBy) === key : owned.has(guest.familyId)))
    .map((guest) => guest.userId);
}

export function resetOctaveAccessForTests(): void {
  cache.clear();
}
