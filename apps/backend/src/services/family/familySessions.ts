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
 * v2 — la famille est PARTAGÉE : les TV de chacune de ses personnes la
 * montrent. Un profil « étranger » sur une TV, c'est tout profil autre que le
 * compte qui l'a jumelée. « Rester sur ce profil » part avec : un profil coupé
 * ne se rouvre jamais sans repasser par « Qui regarde ? » (et son PIN).
 */

const SETTLE_TIMEOUT_MS = 8_000;

async function within(task: Promise<unknown>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([task.catch(() => undefined), new Promise<void>((resolve) => { timer = setTimeout(resolve, ms); })]);
  clearTimeout(timer);
}

export async function endSessions(rows: Array<{ id: string }>, reason: FamilyProfileEndReason): Promise<number> {
  const settled: Promise<void>[] = [];
  for (const row of rows) {
    const revocation = await revokePairedDevice({ id: row.id }, "family", { profileEnd: reason });
    if (revocation) settled.push(revocation.settled);
  }
  if (settled.length) await within(Promise.all(settled), SETTLE_TIMEOUT_MS);
  return settled.length;
}

/** Les TV jumelées par ces comptes. */
async function pairingsOf(accounts: string[]): Promise<Array<{ id: string; jellyfinUserId: string }>> {
  if (accounts.length === 0) return [];
  return getPrisma().pairedDevice.findMany({
    where: { jellyfinUserId: { in: accounts }, parentId: null },
    select: { id: true, jellyfinUserId: true },
  });
}

/** Les sessions d'un profil sur les TV de ces comptes (le membre qui part,
 *  sur les TV des autres). */
export async function endProfileOnTvsOf(accounts: string[], profileUserId: string, reason: FamilyProfileEndReason): Promise<number> {
  const ids = (await pairingsOf(accounts)).map((row) => row.id);
  await forgetSticky({ ids, profileUserId });
  if (ids.length === 0) return 0;
  const rows = await getPrisma().pairedDevice.findMany({
    where: { parentId: { in: ids }, jellyfinUserId: profileUserId },
    select: { id: true },
  });
  return endSessions(rows, reason);
}

/** Sur les TV de ces comptes, toute session autre que celle du compte de la TV
 *  (le membre qui part perd les autres profils ; la dissolution coupe tout). */
export async function endForeignOnTvsOf(accounts: string[], reason: FamilyProfileEndReason): Promise<number> {
  const pairings = await pairingsOf(accounts);
  if (pairings.length === 0) return 0;
  const prisma = getPrisma();
  const sticky = await prisma.pairedDevice.findMany({
    where: { id: { in: pairings.map((row) => row.id) } },
    select: { id: true, jellyfinUserId: true, stickyProfileId: true },
  });
  const foreign = sticky.filter((row) => row.stickyProfileId && row.stickyProfileId !== row.jellyfinUserId).map((row) => row.id);
  if (foreign.length) await prisma.pairedDevice.updateMany({ where: { id: { in: foreign } }, data: { stickyProfileId: null } });
  const accountOf = new Map(pairings.map((row) => [row.id, row.jellyfinUserId]));
  const sessions = await prisma.pairedDevice.findMany({
    where: { parentId: { in: pairings.map((row) => row.id) } },
    select: { id: true, parentId: true, jellyfinUserId: true },
  });
  return endSessions(sessions.filter((row) => row.jellyfinUserId !== accountOf.get(row.parentId ?? "")), reason);
}

/** Un membre quitte la famille (parti, retiré, compte disparu) : son profil
 *  quitte les TV des autres, et les autres profils quittent les siennes. */
export async function endMemberLink(others: string[], leavingUserId: string, reason: FamilyProfileEndReason): Promise<number> {
  const theirs = await endProfileOnTvsOf(others, leavingUserId, reason);
  return theirs + (await endForeignOnTvsOf([leavingUserId], reason));
}

/** Toutes les sessions d'un profil, sur toutes les TV (PIN changé, invité supprimé, compte supprimé). */
export async function endProfileEverywhere(profileUserId: string, reason: FamilyProfileEndReason): Promise<number> {
  await forgetSticky({ profileUserId });
  const rows = await getPrisma().pairedDevice.findMany({
    where: { jellyfinUserId: profileUserId, parentId: { not: null } },
    select: { id: true },
  });
  return endSessions(rows, reason);
}

/**
 * Les interrupteurs de l'administration, partout : « Familles » coupé, chaque
 * TV ne garde que son propre compte ; « Profils invités » coupé, les sessions
 * d'invités tombent.
 */
export async function endSessionsOfKinds(kinds: Array<"member" | "guest">, reason: FamilyProfileEndReason): Promise<number> {
  const prisma = getPrisma();
  const pairings = await prisma.pairedDevice.findMany({
    where: { parentId: null },
    select: { id: true, jellyfinUserId: true, stickyProfileId: true },
  });
  const accountOf = new Map(pairings.map((row) => [row.id, row.jellyfinUserId]));
  const guestIds = new Set((await prisma.familyMember.findMany({ where: { kind: "guest" }, select: { userId: true } })).map((row) => row.userId));
  const everyone = kinds.includes("member");
  const cut = (profile: string, account: string | undefined) => profile !== account && (everyone || guestIds.has(profile));
  const cleared = pairings.filter((row) => row.stickyProfileId && cut(row.stickyProfileId, row.jellyfinUserId)).map((row) => row.id);
  if (cleared.length) await prisma.pairedDevice.updateMany({ where: { id: { in: cleared } }, data: { stickyProfileId: null } });
  const sessions = await prisma.pairedDevice.findMany({
    where: { parentId: { not: null } },
    select: { id: true, parentId: true, jellyfinUserId: true },
  });
  return endSessions(sessions.filter((row) => cut(row.jellyfinUserId, accountOf.get(row.parentId ?? ""))), reason);
}

/** Oublie « Rester sur ce profil » pour ce profil — partout, ou sur ces TV. */
export async function forgetSticky(target: { profileUserId: string; ids?: string[] }): Promise<void> {
  if (target.ids && target.ids.length === 0) return;
  await getPrisma().pairedDevice.updateMany({
    where: { stickyProfileId: target.profileUserId, parentId: null, ...(target.ids && { id: { in: target.ids } }) },
    data: { stickyProfileId: null },
  });
}
