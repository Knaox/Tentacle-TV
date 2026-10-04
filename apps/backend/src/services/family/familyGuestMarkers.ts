import { getPrisma, hasPrisma } from "../db";

/**
 * Le marqueur « invité de la Famille » — la SEULE source que lisent tous les
 * producteurs de listes de comptes (Watch Together, candidats, administration,
 * classement, recommandations en fond) : un invité n'apparaît dans AUCUNE
 * liste (SEC-F-21), seulement dans les sessions en cours, étiqueté du nom de
 * son propriétaire.
 *
 * La base fait foi (`family_members.kind = guest`), gardée 30 secondes ;
 * `forgetFamilyGuests` après toute création ou suppression d'invité. Base
 * muette et aucune réponse connue : on lève — une liste qui ne peut pas
 * écarter les invités ne se rend pas. Sans base du tout (serveur en
 * installation), il n'existe aucune famille, donc aucun invité.
 */

const TTL_MS = 30_000;
let cache: { owners: Map<string, string>; expiresAt: number } | null = null;
let pending: Promise<Map<string, string>> | null = null;

function fold(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

async function load(): Promise<Map<string, string>> {
  if (!hasPrisma()) return new Map();
  const prisma = getPrisma();
  const guests = await prisma.familyMember.findMany({ where: { kind: "guest" }, select: { userId: true, familyId: true } });
  const families = guests.length
    ? await prisma.family.findMany({
        where: { id: { in: [...new Set(guests.map((guest) => guest.familyId))] } },
        select: { id: true, ownerName: true },
      })
    : [];
  const ownerOf = new Map(families.map((family) => [family.id, family.ownerName]));
  return new Map(guests.map((guest) => [fold(guest.userId), ownerOf.get(guest.familyId) ?? ""]));
}

/** Invité → nom de son propriétaire (identifiants pliés : sans tirets, minuscules). */
export async function familyGuestOwners(): Promise<Map<string, string>> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.owners;
  if (!pending) {
    pending = load()
      .then((owners) => {
        cache = { owners, expiresAt: Date.now() + TTL_MS };
        return owners;
      })
      .finally(() => {
        pending = null;
      });
  }
  try {
    return await pending;
  } catch (error) {
    // Une réponse ancienne vaut mieux que de laisser paraître un invité.
    if (cache) return cache.owners;
    throw error;
  }
}

export async function isFamilyGuest(userId: string): Promise<boolean> {
  return (await familyGuestOwners()).has(fold(userId));
}

/** La liste sans les invités de la Famille. */
export async function withoutFamilyGuests<T>(items: T[], userIdOf: (item: T) => string): Promise<T[]> {
  const owners = await familyGuestOwners();
  if (owners.size === 0) return items;
  return items.filter((item) => !owners.has(fold(userIdOf(item))));
}

export function forgetFamilyGuests(): void {
  cache = null;
}
