import { getPrisma } from "../db";
import { revokePairedDevice } from "../deviceRevocation";
import type { FamilyProfileEndReason } from "../../family/familyProtocol";

/**
 * Couper les sessions de profil des TV — par la révocation COMMUNE
 * (`deviceRevocation.ts`) : jeton refusé à toutes les portes, socket prévenue
 * (`family:profile-ended`), session et appareil Jellyfin supprimés. Chaque
 * coupure de la Famille ATTEND ce nettoyage avant de rendre la main
 * (SEC-F-10..15 : la révocation agit avant la réponse HTTP), borné : un
 * Jellyfin muet ne bloque pas le geste — le journal des appareils le reprend.
 *
 * « Rester sur ce profil » part avec : un profil coupé ne se rouvre jamais
 * sans repasser par « Qui regarde ? » (et son PIN).
 */

const SETTLE_TIMEOUT_MS = 8_000;

async function within(task: Promise<unknown>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([task.catch(() => undefined), new Promise<void>((resolve) => { timer = setTimeout(resolve, ms); })]);
  clearTimeout(timer);
}

async function endSessions(rows: Array<{ id: string }>, reason: FamilyProfileEndReason): Promise<number> {
  const settled: Promise<void>[] = [];
  for (const row of rows) {
    const revocation = await revokePairedDevice({ id: row.id }, "family", { profileEnd: reason });
    if (revocation) settled.push(revocation.settled);
  }
  if (settled.length) await within(Promise.all(settled), SETTLE_TIMEOUT_MS);
  return settled.length;
}

/** Les TV d'un propriétaire : ses jumelages. */
async function pairingIdsOf(ownerUserId: string): Promise<string[]> {
  const rows = await getPrisma().pairedDevice.findMany({ where: { jellyfinUserId: ownerUserId, parentId: null }, select: { id: true } });
  return rows.map((row) => row.id);
}

/** Les sessions d'un profil sur les TV d'un propriétaire (membre retiré, parti ; invité supprimé). */
export async function endProfileOnOwnerTvs(ownerUserId: string, profileUserId: string, reason: FamilyProfileEndReason): Promise<number> {
  const pairings = await pairingIdsOf(ownerUserId);
  await forgetSticky({ ids: pairings, profileUserId });
  if (pairings.length === 0) return 0;
  const rows = await getPrisma().pairedDevice.findMany({
    where: { parentId: { in: pairings }, jellyfinUserId: profileUserId },
    select: { id: true },
  });
  return endSessions(rows, reason);
}

/** Toutes les sessions d'un profil, sur toutes les TV (PIN changé, compte supprimé). */
export async function endProfileEverywhere(profileUserId: string, reason: FamilyProfileEndReason): Promise<number> {
  await forgetSticky({ profileUserId });
  const rows = await getPrisma().pairedDevice.findMany({
    where: { jellyfinUserId: profileUserId, parentId: { not: null } },
    select: { id: true },
  });
  return endSessions(rows, reason);
}

/** Les sessions des membres et des invités sur les TV d'un propriétaire (dissolution). */
export async function endFamilyOnOwnerTvs(ownerUserId: string, reason: FamilyProfileEndReason): Promise<number> {
  const pairings = await pairingIdsOf(ownerUserId);
  if (pairings.length === 0) return 0;
  const prisma = getPrisma();
  const sticky = await prisma.pairedDevice.findMany({ where: { id: { in: pairings } }, select: { id: true, stickyProfileId: true } });
  const foreign = sticky.filter((row) => row.stickyProfileId && row.stickyProfileId !== ownerUserId).map((row) => row.id);
  if (foreign.length) await prisma.pairedDevice.updateMany({ where: { id: { in: foreign } }, data: { stickyProfileId: null } });
  const rows = await prisma.pairedDevice.findMany({
    where: { parentId: { in: pairings }, profileKind: { in: ["member", "guest"] } },
    select: { id: true },
  });
  return endSessions(rows, reason);
}

/** Les sessions d'une sorte de profil, partout (interrupteurs de l'administration). */
export async function endSessionsOfKinds(kinds: Array<"member" | "guest">, reason: FamilyProfileEndReason): Promise<number> {
  const prisma = getPrisma();
  const rows = await prisma.pairedDevice.findMany({
    where: { parentId: { not: null }, profileKind: { in: kinds } },
    select: { id: true },
  });
  // Les profils « Rester » de ces sortes : jamais rouverts sans « Qui regarde ? ».
  const pairings = await prisma.pairedDevice.findMany({
    where: { parentId: null, stickyProfileId: { not: null } },
    select: { id: true, jellyfinUserId: true, stickyProfileId: true },
  });
  const guestIds = kinds.includes("member")
    ? null
    : new Set((await prisma.familyMember.findMany({ where: { kind: "guest" }, select: { userId: true } })).map((row) => row.userId));
  const cleared = pairings
    .filter((row) => row.stickyProfileId !== row.jellyfinUserId && (guestIds === null || guestIds.has(row.stickyProfileId ?? "")))
    .map((row) => row.id);
  if (cleared.length) await prisma.pairedDevice.updateMany({ where: { id: { in: cleared } }, data: { stickyProfileId: null } });
  return endSessions(rows, reason);
}

/** Oublie « Rester sur ce profil » pour ce profil — partout, ou sur ces TV. */
export async function forgetSticky(target: { profileUserId: string; ids?: string[] }): Promise<void> {
  if (target.ids && target.ids.length === 0) return;
  await getPrisma().pairedDevice.updateMany({
    where: { stickyProfileId: target.profileUserId, parentId: null, ...(target.ids && { id: { in: target.ids } }) },
    data: { stickyProfileId: null },
  });
}
