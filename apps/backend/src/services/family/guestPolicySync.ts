import { getPrisma, hasPrisma } from "../db";
import { jellyfinAdminFetch } from "../jellyfinAdminFetch";
import { invalidateContentPolicy } from "../contentPolicy";
import type { GuestParentalControls } from "../../family/familyParental";
import { FamilyFailure } from "./familyErrors";
import { fold } from "./familyStore";
import { fetchUser, guestPolicy, writePolicy, type UserDto } from "./guestAccounts";
import { parentalApplied, samePolicy, storedGuestParental } from "./guestParentalPolicy";

/**
 * La politique d'un invité tenue à jour (docs/DROITS-UTILISATEURS.md § 4) : son
 * créateur change — par Tentacle OU directement dans Jellyfin —, l'invité suit.
 * Trois moments : une écriture de politique faite par Tentacle (`notePolicyWritten`
 * → `resyncGuestsOfCreator`), chaque ouverture d'un profil d'invité
 * (`syncGuestPolicy`), et un guet léger — UNE lecture de `/Users` toutes les deux
 * minutes, une écriture seulement si quelque chose a changé.
 */

const WATCH_MS = 2 * 60_000;
let timer: ReturnType<typeof setInterval> | null = null;

interface GuestLink {
  userId: string;
  creatorUserId: string;
  parentalControls: string | null;
}

/** Les invités, chacun avec son créateur (le sien, ou — ligne d'avant la v2 — le propriétaire). */
async function guestLinks(): Promise<GuestLink[]> {
  const prisma = getPrisma();
  const guests = await prisma.familyMember.findMany({ where: { kind: "guest" } });
  if (guests.length === 0) return [];
  const families = await prisma.family.findMany({
    where: { id: { in: [...new Set(guests.map((guest) => guest.familyId))] } },
    select: { id: true, ownerUserId: true },
  });
  const ownerOf = new Map(families.map((family) => [family.id, family.ownerUserId]));
  return guests.flatMap((guest) => {
    const creatorUserId = guest.createdBy ?? ownerOf.get(guest.familyId);
    return creatorUserId ? [{ userId: guest.userId, creatorUserId, parentalControls: guest.parentalControls ?? null }] : [];
  });
}

async function wantedOf(guestUserId: string): Promise<GuestParentalControls> {
  const row = await getPrisma().familyMember.findFirst({ where: { userId: guestUserId, kind: "guest" } });
  return storedGuestParental(row?.parentalControls ?? null);
}

/** Écrit la politique de l'invité si elle diffère de ce qu'elle doit être. `strict` : relit et lève si Jellyfin ne l'a pas retenue. */
async function reconcile(guest: UserDto & { Id: string }, creator: UserDto, wanted: GuestParentalControls, strict: boolean): Promise<boolean> {
  const current = guest.Policy ?? {};
  const target = guestPolicy(guest.Id, current, creator.Policy ?? {}, wanted);
  if (samePolicy(target, current)) return false;
  await writePolicy(guest.Id, target);
  invalidateContentPolicy(guest.Id);
  if (strict && !parentalApplied(target, (await fetchUser(guest.Id)).Policy ?? {})) {
    throw new FamilyFailure("family.jellyfin_refused", "Contrôle parental non retenu par Jellyfin");
  }
  return true;
}

/** Pose le contrôle voulu (déjà gardé en base) sur l'invité. Lève une `FamilyFailure` si Jellyfin refuse ou se tait. */
export async function applyGuestPolicy(guestUserId: string, creatorUserId: string, wanted: GuestParentalControls): Promise<void> {
  const [guest, creator] = await Promise.all([fetchUser(guestUserId), fetchUser(creatorUserId)]);
  await reconcile({ ...guest, Id: guestUserId }, creator, wanted, true);
}

/** À l'ouverture d'une session d'invité. Silencieux : les interdits de l'invité sont déjà dans Jellyfin. */
export async function syncGuestPolicy(guestUserId: string, creatorUserId: string): Promise<void> {
  try {
    const [guest, creator, wanted] = await Promise.all([fetchUser(guestUserId), fetchUser(creatorUserId), wantedOf(guestUserId)]);
    await reconcile({ ...guest, Id: guestUserId }, creator, wanted, false);
  } catch {
    console.log("[family] politique d'un invité non resynchronisée (Jellyfin ou base muets)");
  }
}

/** Tous les invités, d'après UNE lecture des comptes. `onlyCreator` : ceux de ce créateur. */
export async function resyncGuests(onlyCreator?: string): Promise<number> {
  if (!hasPrisma()) return 0;
  const links = (await guestLinks()).filter((link) => !onlyCreator || fold(link.creatorUserId) === fold(onlyCreator));
  if (links.length === 0) return 0;
  const users = await jellyfinAdminFetch<UserDto[]>("/Users");
  if (!users.ok || !Array.isArray(users.data)) return 0;
  const byId = new Map(users.data.filter((user) => user.Id).map((user) => [fold(user.Id as string), user]));
  let written = 0;
  for (const link of links) {
    const guest = byId.get(fold(link.userId));
    const creator = byId.get(fold(link.creatorUserId));
    // Créateur disparu : le balayage de la Famille s'en charge ; on ne relâche rien ici.
    if (!guest?.Id || !creator) continue;
    try {
      if (await reconcile({ ...guest, Id: guest.Id }, creator, storedGuestParental(link.parentalControls), false)) written++;
    } catch {
      console.log("[family] politique d'un invité non resynchronisée (Jellyfin muet)");
    }
  }
  if (written > 0) console.log(`[family] ${written} invité(s) recalé(s) sur leur créateur`);
  return written;
}

/** Après une écriture de politique faite par Tentacle sur ce compte : ses invités suivent. */
export async function resyncGuestsOfCreator(userId: string): Promise<void> {
  await resyncGuests(userId);
}

export function startGuestPolicyWatch(): void {
  if (timer) return;
  timer = setInterval(() => void resyncGuests().catch(() => undefined), WATCH_MS);
}

export function stopGuestPolicyWatch(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
